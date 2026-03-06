"""
Weather data and pest risk prediction using OpenWeather API.
"""
import httpx
import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from auth_utils import get_current_user
from config import settings

router = APIRouter()

OW_BASE = "https://api.openweathermap.org/data/2.5"


async def _fetch_weather(lat: float, lon: float) -> dict:
    url = f"{OW_BASE}/weather?lat={lat}&lon={lon}&appid={settings.OPENWEATHER_API_KEY}&units=metric"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Weather service unavailable")
        return resp.json()


async def _fetch_forecast(lat: float, lon: float) -> dict:
    url = f"{OW_BASE}/forecast?lat={lat}&lon={lon}&appid={settings.OPENWEATHER_API_KEY}&units=metric&cnt=40"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            return {}
        return resp.json()


@router.get("/current")
async def get_weather(lat: float, lon: float, farm_id: int = None,
                       db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    data = await _fetch_weather(lat, lon)
    temp = data["main"]["temp"]
    humidity = data["main"]["humidity"]
    wind = data["wind"]["speed"]
    rain = data.get("rain", {}).get("1h", 0.0)
    description = data["weather"][0]["description"].capitalize()

    # Save weather record
    if farm_id:
        record = models.WeatherRecord(
            farm_id=farm_id,
            temperature=temp,
            humidity=humidity,
            wind_speed=wind,
            precipitation=rain,
            description=description,
            data=data,
        )
        db.add(record)
        db.commit()

    return {
        "temperature": temp,
        "humidity": humidity,
        "wind_speed": wind,
        "precipitation": rain,
        "description": description,
        "feels_like": data["main"]["feels_like"],
        "pressure": data["main"]["pressure"],
        "visibility": data.get("visibility", 10000),
        "icon": data["weather"][0]["icon"],
    }


@router.get("/forecast")
async def get_forecast(lat: float, lon: float, current_user: models.User = Depends(get_current_user)):
    data = await _fetch_forecast(lat, lon)
    forecasts = []
    for item in data.get("list", [])[:10]:
        forecasts.append({
            "datetime": item["dt_txt"],
            "temp": item["main"]["temp"],
            "humidity": item["main"]["humidity"],
            "description": item["weather"][0]["description"],
            "rain": item.get("rain", {}).get("3h", 0),
        })
    return {"forecasts": forecasts}
