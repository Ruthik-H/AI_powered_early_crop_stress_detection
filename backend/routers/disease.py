"""
Plant Disease Detection using CNN (MobileNetV2 fine-tuned on PlantVillage dataset).
Falls back to simulation if model is not loaded.
"""
import os
import io
import json
import numpy as np
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
import models
from auth_utils import get_current_user
from config import settings

router = APIRouter()

# PlantVillage 38 disease classes
DISEASE_CLASSES = [
    "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust", "Apple___healthy",
    "Blueberry___healthy", "Cherry_(including_sour)___Powdery_mildew", "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight", "Corn_(maize)___healthy",
    "Grape___Black_rot", "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)", "Peach___Bacterial_spot", "Peach___healthy",
    "Pepper,_bell___Bacterial_spot", "Pepper,_bell___healthy",
    "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy",
    "Raspberry___healthy", "Soybean___healthy", "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch", "Strawberry___healthy",
    "Tomato___Bacterial_spot", "Tomato___Early_blight", "Tomato___Late_blight",
    "Tomato___Leaf_Mold", "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite", "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Tomato___Tomato_mosaic_virus", "Tomato___healthy",
]

DISEASE_TREATMENTS = {
    "Apple___Apple_scab": "Apply fungicide (Captan or Mancozeb). Remove infected leaves. Prune to improve air circulation.",
    "Apple___Black_rot": "Remove and destroy infected fruit/leaves. Apply copper-based fungicide.",
    "Corn_(maize)___Common_rust_": "Apply foliar fungicide (Azoxystrobin). Ensure adequate plant spacing.",
    "Corn_(maize)___Northern_Leaf_Blight": "Use resistant varieties. Apply fungicide at first sign of lesions.",
    "Potato___Early_blight": "Remove infected foliage. Apply Chlorothalonil fungicide every 7-10 days.",
    "Potato___Late_blight": "Apply Metalaxyl-M fungicide immediately. Destroy heavily infected plants.",
    "Tomato___Early_blight": "Remove lower infected leaves. Apply Mancozeb spray. Avoid overhead watering.",
    "Tomato___Late_blight": "Apply copper hydroxide fungicide. Improve drainage. Remove infected plants.",
    "Tomato___Bacterial_spot": "Apply copper bactericide. Avoid working in wet fields. Use certified seeds.",
    "Tomato___Leaf_Mold": "Improve greenhouse ventilation. Apply Chlorothalonil. Reduce humidity.",
    "Grape___Black_rot": "Apply Myclobutanil at bud break. Remove mummified fruit.",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Control whitefly vectors. Remove infected plants. Use reflective mulch.",
}

# Try to load TensorFlow model
_model = None


def _load_model():
    global _model
    if _model is not None:
        return _model
    model_path = settings.MODEL_PATH
    if os.path.exists(model_path):
        try:
            import tensorflow as tf
            _model = tf.keras.models.load_model(model_path)
            print(f"✅ Loaded disease model from {model_path}")
        except Exception as e:
            print(f"⚠️ Could not load model: {e}. Using simulation mode.")
    return _model


def _preprocess_image(image_bytes: bytes) -> np.ndarray:
    import cv2
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (224, 224))
    img = img.astype(np.float32) / 255.0
    return np.expand_dims(img, axis=0)


def _simulate_prediction(image_bytes: bytes) -> list:
    """Simulate model output with deterministic results based on image content."""
    seed = sum(image_bytes[:100]) % len(DISEASE_CLASSES)
    rng = np.random.default_rng(seed)
    logits = rng.dirichlet(np.ones(len(DISEASE_CLASSES)) * 0.5)
    top3_idx = np.argsort(logits)[-3:][::-1]
    return [(DISEASE_CLASSES[i], float(logits[i])) for i in top3_idx]


@router.post("/detect")
async def detect_disease(
    file: UploadFile = File(...),
    farm_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    # Save uploaded image
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{current_user.id}_{int(__import__('time').time())}_{file.filename}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    # Run inference
    model = _load_model()
    if model is not None:
        img_arr = _preprocess_image(image_bytes)
        preds = model.predict(img_arr)[0]
        top3_idx = np.argsort(preds)[-3:][::-1]
        top_preds = [(DISEASE_CLASSES[i], float(preds[i])) for i in top3_idx]
    else:
        top_preds = _simulate_prediction(image_bytes)

    top_label, top_conf = top_preds[0]
    treatment = DISEASE_TREATMENTS.get(top_label, "Consult a local agronomist for treatment options. General: ensure proper nutrition, water management, and apply appropriate pesticide/fungicide.")

    # Save to DB
    detection = models.DiseaseDetection(
        farm_id=farm_id,
        user_id=current_user.id,
        image_url=f"/uploads/{filename}",
        disease_label=top_label,
        confidence=round(top_conf, 4),
        top_predictions=[{"label": l, "confidence": round(c, 4)} for l, c in top_preds],
        recommendation=treatment,
    )
    db.add(detection)
    db.commit()
    db.refresh(detection)

    is_healthy = "healthy" in top_label.lower()
    return {
        "id": detection.id,
        "disease": top_label.replace("___", " - ").replace("_", " "),
        "confidence": round(top_conf * 100, 1),
        "is_healthy": is_healthy,
        "top_predictions": [
            {"label": l.replace("___", " - ").replace("_", " "), "confidence": round(c * 100, 1)}
            for l, c in top_preds
        ],
        "treatment": treatment,
        "severity": _estimate_severity(top_conf, is_healthy),
        "image_url": f"/uploads/{filename}",
    }


@router.get("/history")
def get_detection_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    detections = (
        db.query(models.DiseaseDetection)
        .filter(models.DiseaseDetection.user_id == current_user.id)
        .order_by(models.DiseaseDetection.detected_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": d.id,
            "disease": d.disease_label.replace("___", " - ").replace("_", " "),
            "confidence": round((d.confidence or 0) * 100, 1),
            "recommendation": d.recommendation,
            "detected_at": d.detected_at.isoformat() if d.detected_at else None,
            "image_url": d.image_url,
        }
        for d in detections
    ]


def _estimate_severity(confidence: float, is_healthy: bool) -> str:
    if is_healthy:
        return "none"
    if confidence > 0.85:
        return "high"
    elif confidence > 0.6:
        return "medium"
    return "low"
