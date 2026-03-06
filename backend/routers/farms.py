from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
import json
from database import get_db
import models
from auth_utils import get_current_user

router = APIRouter()


class FarmCreate(BaseModel):
    name: str
    crop_type: Optional[str] = "Mixed"
    location_name: Optional[str] = ""
    boundary: dict  # GeoJSON polygon


class FarmOut(BaseModel):
    id: int
    name: str
    crop_type: str
    location_name: Optional[str]
    area_hectares: Optional[float]
    boundary: Optional[dict]

    class Config:
        from_attributes = True


def geojson_to_wkt(geojson: dict) -> str:
    """Convert GeoJSON polygon to WKT format for PostGIS."""
    coords = geojson["coordinates"][0]
    coord_str = ", ".join(f"{lng} {lat}" for lng, lat in coords)
    return f"POLYGON(({coord_str}))"


def calc_area_hectares(geojson: dict) -> float:
    """Rough area estimation in hectares."""
    try:
        from shapely.geometry import shape
        polygon = shape(geojson)
        # Approximate: 1 degree ≈ 111km
        area_deg2 = polygon.area
        area_m2 = area_deg2 * (111_000 ** 2)
        return round(area_m2 / 10_000, 2)
    except Exception:
        return 0.0


@router.post("/", response_model=FarmOut)
def create_farm(farm_in: FarmCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    wkt = geojson_to_wkt(farm_in.boundary)
    area = calc_area_hectares(farm_in.boundary)
    farm = models.Farm(
        user_id=current_user.id,
        name=farm_in.name,
        crop_type=farm_in.crop_type or "Mixed",
        location_name=farm_in.location_name,
        boundary=f"SRID=4326;{wkt}",
        area_hectares=area,
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return _farm_to_out(farm)


@router.get("/", response_model=List[FarmOut])
def list_farms(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    farms = db.query(models.Farm).filter(models.Farm.user_id == current_user.id).all()
    return [_farm_to_out(f) for f in farms]


@router.get("/{farm_id}", response_model=FarmOut)
def get_farm(farm_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    farm = db.query(models.Farm).filter(models.Farm.id == farm_id, models.Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return _farm_to_out(farm)


@router.delete("/{farm_id}")
def delete_farm(farm_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    farm = db.query(models.Farm).filter(models.Farm.id == farm_id, models.Farm.user_id == current_user.id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    db.delete(farm)
    db.commit()
    return {"message": "Farm deleted"}


def _farm_to_out(farm: models.Farm) -> dict:
    boundary_geojson = None
    if farm.boundary is not None:
        try:
            shape = to_shape(farm.boundary)
            boundary_geojson = mapping(shape)
        except Exception:
            pass
    return {
        "id": farm.id,
        "name": farm.name,
        "crop_type": farm.crop_type,
        "location_name": farm.location_name,
        "area_hectares": farm.area_hectares,
        "boundary": boundary_geojson,
    }
