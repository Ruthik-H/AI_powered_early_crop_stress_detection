"""
Pest risk prediction based on weather conditions.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from auth_utils import get_current_user
from config import settings

router = APIRouter()


def calculate_pest_risk(temp: float, humidity: float, rain: float, wind: float) -> dict:
    """
    Pest risk model based on agro-meteorological research:
    - Most fungal diseases thrive at 20-28°C with >80% humidity
    - Aphids/mites proliferate in warm, dry conditions (>25°C, <40% humidity)
    - Locusts: dry hot conditions (>30°C, low rain)
    """
    risk_score = 0.0
    risks = []

    # Fungal disease risk (late blight, powdery mildew, etc.)
    if 18 <= temp <= 28 and humidity >= 80:
        fungal_risk = min(1.0, (humidity - 80) / 20.0 + (1 - abs(temp - 23) / 10))
        risk_score += fungal_risk * 0.4
        if fungal_risk > 0.6:
            risks.append({"type": "Fungal Disease", "risk": "High", "description": "Conditions favor Late Blight, Powdery Mildew", "action": "Apply preventive fungicide immediately"})

    # Aphid / Mite risk
    if temp > 25 and humidity < 50:
        aphid_risk = min(1.0, (temp - 25) / 10.0)
        risk_score += aphid_risk * 0.3
        if aphid_risk > 0.5:
            risks.append({"type": "Aphids/Spider Mites", "risk": "Medium", "description": "Warm dry conditions favor rapid insect population growth", "action": "Monitor leaf undersides. Apply neem oil or insecticide."})

    # Locust / migratory pest risk
    if temp > 30 and rain < 1.0:
        locust_risk = min(1.0, (temp - 30) / 10.0)
        risk_score += locust_risk * 0.2
        if locust_risk > 0.4:
            risks.append({"type": "Locust/Grasshopper", "risk": "Medium", "description": "Hot dry conditions attract migratory pests", "action": "Set up pheromone traps. Alert local agricultural authority."})

    # Caterpillar risk
    if 22 <= temp <= 30 and 60 <= humidity <= 80:
        risks.append({"type": "Caterpillars/Armyworm", "risk": "Low", "description": "Mild conditions can support caterpillar activity", "action": "Inspect field borders. Apply Bt (Bacillus thuringiensis) if needed."})
        risk_score += 0.1

    overall = "Low"
    if risk_score > 0.6:
        overall = "High"
    elif risk_score > 0.3:
        overall = "Medium"

    return {
        "overall_risk": overall,
        "risk_score": round(min(risk_score, 1.0) * 100, 1),
        "pests": risks,
        "weather_summary": {"temp": temp, "humidity": humidity, "rain": rain, "wind": wind},
    }


@router.get("/predict")
async def predict_pest_risk(lat: float, lon: float, current_user: models.User = Depends(get_current_user)):
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={settings.OPENWEATHER_API_KEY}&units=metric"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            data = resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Weather service unavailable")

    temp = data["main"]["temp"]
    humidity = data["main"]["humidity"]
    rain = data.get("rain", {}).get("1h", 0.0)
    wind = data["wind"]["speed"]

    return calculate_pest_risk(temp, humidity, rain, wind)
