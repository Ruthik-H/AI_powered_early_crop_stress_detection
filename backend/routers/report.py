"""
Farm Health Report generation combining NDVI + disease + weather + yield data.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
import models
from auth_utils import get_current_user

router = APIRouter()


@router.get("/{farm_id}")
def get_farm_report(farm_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    farm = db.query(models.Farm).filter(models.Farm.id == farm_id, models.Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    # Latest satellite
    latest_sat = (
        db.query(models.SatelliteRecord)
        .filter(models.SatelliteRecord.farm_id == farm_id)
        .order_by(models.SatelliteRecord.date.desc())
        .first()
    )

    # Latest disease detection
    latest_disease = (
        db.query(models.DiseaseDetection)
        .filter(models.DiseaseDetection.farm_id == farm_id)
        .order_by(models.DiseaseDetection.detected_at.desc())
        .first()
    )

    # Latest weather
    latest_weather = (
        db.query(models.WeatherRecord)
        .filter(models.WeatherRecord.farm_id == farm_id)
        .order_by(models.WeatherRecord.date.desc())
        .first()
    )

    # Build health score (0–100)
    score = 70  # baseline
    ndvi_score = None
    if latest_sat:
        ndvi_mean = latest_sat.ndvi_mean or 0.5
        ndvi_score = round(min(100, ndvi_mean * 150), 1)
        score = int(ndvi_score)

    disease_risk = "Unknown"
    if latest_disease:
        if "healthy" in (latest_disease.disease_label or "").lower():
            disease_risk = "Low"
        elif (latest_disease.confidence or 0) > 0.8:
            disease_risk = "High"
            score = max(0, score - 20)
        else:
            disease_risk = "Medium"
            score = max(0, score - 10)

    irrigation_needed = False
    if latest_sat and latest_sat.ndmi_mean is not None and latest_sat.ndmi_mean < 0.1:
        irrigation_needed = True

    overall_status = "Excellent" if score >= 80 else ("Good" if score >= 60 else ("Fair" if score >= 40 else "Poor"))

    recommendations = []
    if irrigation_needed:
        recommendations.append("💧 Irrigation recommended — moisture levels are below optimal.")
    if disease_risk == "High":
        recommendations.append("🚨 Disease risk is HIGH. Apply treatment immediately.")
    if latest_sat and latest_sat.health_status == "stressed":
        recommendations.append("⚠️ Crop stress detected. Review fertilizer and water schedule.")
    recommendations.append("📡 Schedule next satellite analysis in 7 days for trend monitoring.")

    return {
        "farm_id": farm_id,
        "farm_name": farm.name,
        "crop_type": farm.crop_type,
        "area_hectares": farm.area_hectares,
        "generated_at": datetime.utcnow().isoformat(),
        "overall_health_score": score,
        "overall_status": overall_status,
        "ndvi": {
            "mean": latest_sat.ndvi_mean if latest_sat else None,
            "min": latest_sat.ndvi_min if latest_sat else None,
            "max": latest_sat.ndvi_max if latest_sat else None,
            "health_status": latest_sat.health_status if latest_sat else "unknown",
        },
        "ndmi": {
            "mean": latest_sat.ndmi_mean if latest_sat else None,
            "irrigation_needed": irrigation_needed,
        },
        "disease": {
            "risk_level": disease_risk,
            "latest_detection": latest_disease.disease_label if latest_disease else None,
            "confidence": latest_disease.confidence if latest_disease else None,
        },
        "weather": {
            "temperature": latest_weather.temperature if latest_weather else None,
            "humidity": latest_weather.humidity if latest_weather else None,
            "description": latest_weather.description if latest_weather else None,
        },
        "recommendations": recommendations,
    }
