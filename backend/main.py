"""
Precision Agriculture Monitoring Platform - FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from routers import farms, satellite, disease, weather, pest_risk, yield_pred, report, chat
from database import engine, Base

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Precision Agriculture Monitoring API",
    description="AI-powered crop monitoring, disease detection, and smart farming recommendations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
app.include_router(farms.router, prefix="/api/farms", tags=["Farms"])
app.include_router(satellite.router, prefix="/api/satellite", tags=["Satellite Data"])
app.include_router(disease.router, prefix="/api/disease", tags=["Disease Detection"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])
app.include_router(pest_risk.router, prefix="/api/pest-risk", tags=["Pest Risk"])
app.include_router(yield_pred.router, prefix="/api/yield", tags=["Yield Prediction"])
app.include_router(report.router, prefix="/api/report", tags=["Reports"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Assistant"])


@app.get("/")
def root():
    return {"message": "Precision Agriculture Monitoring Platform API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
