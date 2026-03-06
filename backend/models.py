from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    farms = relationship("Farm", back_populates="owner")


class Farm(Base):
    __tablename__ = "farms"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    crop_type = Column(String, default="Mixed")
    location_name = Column(String)
    boundary = Column(Geometry("POLYGON", srid=4326))
    area_hectares = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    owner = relationship("User", back_populates="farms")
    satellite_records = relationship("SatelliteRecord", back_populates="farm", cascade="all, delete")
    weather_records = relationship("WeatherRecord", back_populates="farm", cascade="all, delete")
    disease_detections = relationship("DiseaseDetection", back_populates="farm", cascade="all, delete")


class SatelliteRecord(Base):
    __tablename__ = "satellite_records"
    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    ndvi_mean = Column(Float)
    ndvi_min = Column(Float)
    ndvi_max = Column(Float)
    ndmi_mean = Column(Float)
    health_status = Column(String)  # healthy / moderate / stressed / high_moisture
    heatmap_data = Column(JSON)
    imagery_url = Column(String)
    cloud_cover = Column(Float)
    farm = relationship("Farm", back_populates="satellite_records")


class WeatherRecord(Base):
    __tablename__ = "weather_records"
    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    temperature = Column(Float)
    humidity = Column(Float)
    wind_speed = Column(Float)
    precipitation = Column(Float)
    description = Column(String)
    pest_risk_score = Column(Float)
    data = Column(JSON)
    farm = relationship("Farm", back_populates="weather_records")


class DiseaseDetection(Base):
    __tablename__ = "disease_detections"
    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_url = Column(String)
    disease_label = Column(String)
    confidence = Column(Float)
    top_predictions = Column(JSON)
    recommendation = Column(Text)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    farm = relationship("Farm", back_populates="disease_detections")


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id"), nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    ndvi_score = Column(Float)
    ndmi_score = Column(Float)
    disease_risk = Column(String)
    pest_risk = Column(String)
    yield_estimate = Column(Float)
    irrigation_needed = Column(Boolean, default=False)
    summary = Column(JSON)
    recommendations = Column(JSON)
