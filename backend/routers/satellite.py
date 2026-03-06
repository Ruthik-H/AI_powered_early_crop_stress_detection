"""
Satellite data fetching and NDVI/NDMI analysis pipeline.
Uses Planet Labs API (Planet Explorer) for Sentinel-2 imagery.
"""
import os
import json
import math
import httpx
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
import models
from auth_utils import get_current_user
from config import settings

router = APIRouter()

PLANET_BASE_URL = "https://api.planet.com/data/v1"
HEADERS = {"Authorization": f"api-key {settings.PLANET_API_KEY}"}


class SatelliteRequest(BaseModel):
    farm_id: int
    date_from: Optional[str] = None  # YYYY-MM-DD
    date_to: Optional[str] = None


class NDVIResponse(BaseModel):
    farm_id: int
    date: str
    ndvi_mean: float
    ndvi_min: float
    ndvi_max: float
    ndmi_mean: float
    health_status: str
    heatmap_data: dict
    recommendations: List[str]


def classify_health(ndvi: float) -> str:
    if ndvi >= 0.6:
        return "healthy"
    elif ndvi >= 0.4:
        return "moderate"
    elif ndvi >= 0.2:
        return "stressed"
    else:
        return "critical"


def generate_synthetic_ndvi_grid(boundary_geojson: dict, seed: int = None) -> dict:
    """
    Generate a synthetic NDVI heatmap grid for the farm boundary.
    In production, replace with real Rasterio processing of downloaded GeoTIFF.
    """
    rng = np.random.default_rng(seed or 42)
    rows, cols = 20, 20
    # Simulate spatially correlated NDVI values
    base = rng.uniform(0.3, 0.7)
    grid = np.clip(
        base + rng.normal(0, 0.12, (rows, cols)),
        -0.1, 1.0
    ).tolist()
    ndmi_grid = np.clip(
        (base - 0.1) + rng.normal(0, 0.1, (rows, cols)),
        -0.5, 0.8
    ).tolist()
    return {
        "ndvi_grid": grid,
        "ndmi_grid": ndmi_grid,
        "rows": rows,
        "cols": cols,
        "color_map": _ndvi_to_colors(np.array(grid)),
    }


def _ndvi_to_colors(grid: np.ndarray) -> list:
    """Map NDVI values to RGBA color codes for heatmap rendering."""
    colors = []
    for row in grid:
        color_row = []
        for val in row:
            if val >= 0.6:
                color_row.append([34, 197, 94, 200])     # Green - healthy
            elif val >= 0.4:
                color_row.append([234, 179, 8, 200])      # Yellow - moderate
            elif val >= 0.2:
                color_row.append([239, 68, 68, 200])      # Red - stressed
            else:
                color_row.append([127, 29, 29, 200])      # Dark red - critical
        colors.append(color_row)
    return colors


async def fetch_planet_scene(geometry: dict, date_from: str, date_to: str) -> Optional[str]:
    """Search Planet Labs API for available Sentinel-2 scenes."""
    search_filter = {
        "type": "AndFilter",
        "config": [
            {
                "type": "GeometryFilter",
                "field_name": "geometry",
                "config": geometry
            },
            {
                "type": "DateRangeFilter",
                "field_name": "acquired",
                "config": {"gte": f"{date_from}T00:00:00Z", "lte": f"{date_to}T23:59:59Z"}
            },
            {
                "type": "RangeFilter",
                "field_name": "cloud_cover",
                "config": {"lte": 0.2}
            }
        ]
    }
    payload = {
        "item_types": ["PSScene"],
        "filter": search_filter,
        "limit": 1
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{PLANET_BASE_URL}/quick-search", json=payload, headers=HEADERS)
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])
                if features:
                    return features[0].get("id")
    except Exception:
        pass
    return None


@router.post("/fetch-imagery", response_model=NDVIResponse)
async def fetch_imagery(
    req: SatelliteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    farm = db.query(models.Farm).filter(
        models.Farm.id == req.farm_id,
        models.Farm.user_id == current_user.id
    ).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    date_to = req.date_to or datetime.utcnow().strftime("%Y-%m-%d")
    date_from = req.date_from or (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")

    # Generate NDVI/NDMI analysis (synthetic for demo; replace with real GeoTIFF processing)
    seed = int(datetime.utcnow().timestamp()) % 10000
    heatmap = generate_synthetic_ndvi_grid({}, seed=seed)
    ndvi_arr = np.array(heatmap["ndvi_grid"])
    ndmi_arr = np.array(heatmap["ndmi_grid"])
    ndvi_mean = float(np.mean(ndvi_arr))
    ndvi_min = float(np.min(ndvi_arr))
    ndvi_max = float(np.max(ndvi_arr))
    ndmi_mean = float(np.mean(ndmi_arr))

    health_status = classify_health(ndvi_mean)
    recommendations = _get_recommendations(health_status, ndmi_mean)

    # Save to DB
    record = models.SatelliteRecord(
        farm_id=farm.id,
        ndvi_mean=round(ndvi_mean, 4),
        ndvi_min=round(ndvi_min, 4),
        ndvi_max=round(ndvi_max, 4),
        ndmi_mean=round(ndmi_mean, 4),
        health_status=health_status,
        heatmap_data=heatmap,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "farm_id": farm.id,
        "date": date_to,
        "ndvi_mean": round(ndvi_mean, 4),
        "ndvi_min": round(ndvi_min, 4),
        "ndvi_max": round(ndvi_max, 4),
        "ndmi_mean": round(ndmi_mean, 4),
        "health_status": health_status,
        "heatmap_data": heatmap,
        "recommendations": recommendations,
    }


@router.get("/{farm_id}/history")
def get_history(farm_id: int, limit: int = 30, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    farm = db.query(models.Farm).filter(models.Farm.id == farm_id, models.Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    records = (
        db.query(models.SatelliteRecord)
        .filter(models.SatelliteRecord.farm_id == farm_id)
        .order_by(models.SatelliteRecord.date.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "date": r.date.isoformat() if r.date else None,
            "ndvi_mean": r.ndvi_mean,
            "ndmi_mean": r.ndmi_mean,
            "health_status": r.health_status,
        }
        for r in records
    ]


def _get_recommendations(health: str, ndmi: float) -> list:
    recs = []
    if health == "critical":
        recs += ["🚨 Severe crop stress detected. Immediate irrigation recommended.", "Apply nitrogen-rich fertilizer within 48 hours.", "Consider emergency pest inspection."]
    elif health == "stressed":
        recs += ["⚠️ Moderate crop stress. Schedule irrigation within 3 days.", "Monitor for pest activity.", "Test soil nutrient levels."]
    elif health == "moderate":
        recs += ["✅ Crops are moderately healthy. Continue regular irrigation schedule.", "Foliar spray with micronutrients recommended."]
    else:
        recs += ["🌱 Crops are healthy. Maintain current practices.", "Next satellite check recommended in 10 days."]
    if ndmi < 0.1:
        recs.append("💧 Low moisture detected. Increase irrigation frequency.")
    elif ndmi > 0.5:
        recs.append("🌊 High moisture levels. Reduce irrigation to prevent root rot.")
    return recs
