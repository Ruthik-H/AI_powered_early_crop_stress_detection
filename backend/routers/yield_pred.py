"""
Yield prediction based on NDVI time series and crop type.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from auth_utils import get_current_user

router = APIRouter()

# Maximum yield (kg/hectare) per crop type
CROP_YIELD_MAX = {
    "Rice": 7000,
    "Wheat": 5500,
    "Corn": 9000,
    "Tomato": 70000,
    "Potato": 40000,
    "Soybean": 3500,
    "Mixed": 5000,
    "Cotton": 2000,
    "Sugarcane": 80000,
    "Sunflower": 2500,
    "Millet": 2000,
}


@router.get("/{farm_id}/predict")
def predict_yield(farm_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    farm = db.query(models.Farm).filter(models.Farm.id == farm_id, models.Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    # Get latest satellite records for NDVI analysis
    records = (
        db.query(models.SatelliteRecord)
        .filter(models.SatelliteRecord.farm_id == farm_id)
        .order_by(models.SatelliteRecord.date.desc())
        .limit(10)
        .all()
    )

    if not records:
        # Default estimate with no data
        ndvi_avg = 0.5
        trend = "stable"
    else:
        ndvi_values = [r.ndvi_mean for r in records if r.ndvi_mean is not None]
        ndvi_avg = sum(ndvi_values) / len(ndvi_values) if ndvi_values else 0.5
        # Simple trend: compare first half vs second half
        if len(ndvi_values) >= 4:
            first_half = sum(ndvi_values[len(ndvi_values)//2:]) / (len(ndvi_values)//2)
            second_half = sum(ndvi_values[:len(ndvi_values)//2]) / (len(ndvi_values)//2)
            diff = second_half - first_half
            trend = "improving" if diff > 0.05 else ("declining" if diff < -0.05 else "stable")
        else:
            trend = "stable"

    crop_type = farm.crop_type or "Mixed"
    max_yield = CROP_YIELD_MAX.get(crop_type, 5000)
    area = farm.area_hectares or 1.0

    # NDVI-based yield regression (simplified Monteith model)
    # Yield ≈ max_yield × NDVI_factor × area_factor
    ndvi_factor = max(0, min(1.0, (ndvi_avg - 0.1) / 0.7))
    trend_multiplier = {"improving": 1.05, "stable": 1.0, "declining": 0.9}.get(trend, 1.0)

    yield_per_ha = max_yield * ndvi_factor * trend_multiplier
    total_yield = yield_per_ha * area

    confidence = "High" if len(records) >= 5 else ("Medium" if len(records) >= 2 else "Low")

    return {
        "farm_id": farm_id,
        "farm_name": farm.name,
        "crop_type": crop_type,
        "area_hectares": area,
        "ndvi_average": round(ndvi_avg, 4),
        "ndvi_trend": trend,
        "estimated_yield_per_ha": round(yield_per_ha, 1),
        "estimated_total_yield_kg": round(total_yield, 1),
        "confidence": confidence,
        "data_points": len(records),
        "recommendations": _yield_recommendations(ndvi_avg, trend),
    }


def _yield_recommendations(ndvi: float, trend: str) -> list:
    recs = []
    if trend == "declining":
        recs.append("⚠️ NDVI trend is declining — yield at risk. Investigate irrigation and fertilizer schedule.")
    if ndvi < 0.4:
        recs.append("🌾 Low vegetation index suggests poor canopy cover. Consider replanting thinly vegetated zones.")
    if ndvi >= 0.6:
        recs.append("✅ Strong vegetation health. Yield expectations are on track.")
    recs.append("📊 For accurate yield mapping, request weekly satellite analysis.")
    return recs
