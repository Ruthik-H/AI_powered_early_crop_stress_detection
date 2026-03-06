"""
AI Agronomy Chatbot - rule-based knowledge base with smart crop/disease/pest answers.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth_utils import get_current_user
import models

router = APIRouter()

KNOWLEDGE_BASE = {
    # Irrigation
    "irrigation": "💧 Irrigate when NDMI < 0.1 or soil moisture is below field capacity. Drip irrigation saves 40–60% water vs flood irrigation. Irrigate early morning to minimize evaporation.",
    "water stress": "💧 Water stress shows as wilting, leaf curl, or NDVI drop below 0.35. Increase irrigation frequency. For severe stress, apply 2–3 cm water daily until recovery.",
    "drip irrigation": "💦 Drip irrigation delivers water directly to roots, preventing foliar fungal diseases and reducing water use by 50%. Install pressure-compensating emitters for slopes.",

    # Fertilizer
    "fertilizer": "🌿 Apply NPK based on soil test. General: 120-60-60 kg/ha for cereals. Split nitrogen into 3 applications (basal, tillering, panicle initiation). Use organic compost to improve soil structure.",
    "nitrogen": "🌾 Nitrogen deficiency = yellowing of older leaves. Apply urea (46% N) at 50 kg/ha. Excessive nitrogen causes lodging and increases disease susceptibility.",
    "phosphorus": "🌱 Phosphorus promotes root growth. Deficiency shows as purple discoloration. Apply DAP at planting. P is immobile — apply at soil level.",
    "potassium": "💪 Potassium improves drought resistance and disease tolerance. Deficiency = leaf edge browning. Apply MOP (60% K2O) at 60 kg/ha.",
    "micronutrients": "⚗️ Zinc deficiency is most common — causes stunted growth. Apply zinc sulfate at 25 kg/ha. Boron deficiency affects flowering.",

    # Diseases
    "blight": "🦠 Blight is caused by Phytophthora or Alternaria fungi. Apply Mancozeb or Metalaxyl-M fungicide. Remove infected plant tissue. Avoid overhead irrigation.",
    "rust": "🟤 Rust spreads via wind spores. Apply triazole fungicides (Propiconazole). Plant resistant varieties. Early detection is key — check leaf undersides.",
    "mold": "🍄 Leaf mold thrives in humid, warm conditions. Improve air circulation. Reduce humidity in greenhouses. Apply Chlorothalonil fungicide.",
    "bacterial spot": "🔴 Bacterial spot — apply copper bactericide every 7 days in wet weather. Avoid working in wet fields. Use certified disease-free seeds.",
    "viral disease": "🦟 Most viral diseases have no cure. Control insect vectors (aphids, whiteflies) with insecticides or reflective mulch. Remove and destroy infected plants.",
    "powdery mildew": "⬜ Powdery mildew appears as white powder on leaves. Apply sulfur-based fungicide or potassium bicarbonate. Improve air flow. Avoid overhead irrigation.",

    # Pests
    "aphids": "🐛 Aphids cluster under leaves, causing curling. Apply neem oil (3ml/L water) or imidacloprid insecticide. Introduce ladybugs as biological control.",
    "mites": "🕷️ Spider mites cause stippling on leaves. Apply Abamectin or sulfur spray. Mites thrive in hot/dry conditions — maintain adequate moisture.",
    "caterpillar": "🐛 Apply Bacillus thuringiensis (Bt) — safe biological insecticide. For fall armyworm: apply Chlorpyriphos. Monitor leaf damage — act early.",
    "locust": "🦗 Locust swarms — contact your national agricultural pest control authority immediately. Apply Malathion or Deltamethrin aerial spray early morning.",
    "whitefly": "🦟 Whiteflies spread viruses. Apply yellow sticky traps. Use pyriproxyfen or spiromesifen insecticide. Reflect sunlight with silver mulch.",

    # NDVI
    "ndvi": "📡 NDVI (Normalized Difference Vegetation Index) measures plant health using red and near-infrared satellite bands. Range: -1 to 1. Healthy crops: 0.6–0.9. Below 0.3 indicates severe stress.",
    "ndmi": "💧 NDMI (Normalized Difference Moisture Index) measures canopy water content. Above 0.4 = high moisture. Below 0.1 = drought stress. Used for irrigation scheduling.",
    "satellite": "🛰️ Satellite monitoring uses Sentinel-2 imagery (10m resolution) to analyze NDVI, NDMI, EVI, and SAVI vegetation indices across your entire farm at once.",

    # Yield
    "yield": "🌾 Yield prediction uses NDVI time series. Healthy NDVI (>0.6) throughout the season typically achieves 85–95% of maximum potential yield. Iron out stress periods early to protect yield.",
    "harvest": "✂️ Harvest timing: for cereals, harvest when grain moisture is 20–25%. For tomatoes, harvest at 90% red color. NDVI typically drops near maturity — use this as a harvest indicator.",

    # General
    "soil": "🌍 Healthy soil = 45% minerals, 25% air, 25% water, 5% organic matter. Maintain pH 6.0–7.0 for most crops. Test soil every 2 years.",
    "crop rotation": "🔄 Crop rotation breaks pest and disease cycles. Rotate legumes (fix nitrogen) with cereals. Avoid planting the same family (Solanaceae, Cucurbitaceae) in the same field consecutively.",
    "hello": "👋 Hello! I'm your AI Agronomy Assistant. Ask me about crop diseases, irrigation, fertilizers, pest control, or satellite monitoring. How can I help your farm today?",
    "help": "🤖 I can help with: Irrigation scheduling | Fertilizer recommendations | Disease identification & treatment | Pest control | NDVI/NDMI interpretation | Yield prediction. What's your concern?",
}


class ChatMessage(BaseModel):
    message: str
    farm_id: int = None


@router.post("/message")
def chat(msg: ChatMessage, current_user: models.User = Depends(get_current_user)):
    query = msg.message.lower().strip()

    # Find best matching topic
    response = None
    best_score = 0
    for keyword, answer in KNOWLEDGE_BASE.items():
        words = set(keyword.lower().split())
        query_words = set(query.split())
        overlap = len(words & query_words)
        # Also check substring match
        if keyword in query or any(w in query for w in words):
            score = overlap + (2 if keyword in query else 0)
            if score > best_score:
                best_score = score
                response = answer

    if not response:
        # Generic fallback
        response = (
            "🤔 I don't have specific information on that topic. Here's what I can help with:\n\n"
            "• 💧 Irrigation & water management\n"
            "• 🌿 Fertilizer & soil nutrients\n"
            "• 🦠 Disease identification & treatment\n"
            "• 🐛 Pest control strategies\n"
            "• 📡 NDVI/NDMI satellite analysis\n"
            "• 🌾 Yield optimization\n\n"
            "Please consult your local agricultural extension officer for field-specific advice."
        )

    return {
        "response": response,
        "user": current_user.full_name or current_user.email,
    }
