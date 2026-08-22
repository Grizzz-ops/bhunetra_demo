import os
from dotenv import load_dotenv

# Load variables from the .env file into the system environment
load_dotenv()

from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Dict, Any

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from geoalchemy2 import Geometry
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import shape, mapping
from apscheduler.schedulers.background import BackgroundScheduler

# ==========================================
# 1. CONFIGURATION & RAILWAY TRAP FIX
# ==========================================
# Railway connection strings start with 'postgres://', but SQLAlchemy requires 'postgresql://'.
raw_db_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(raw_db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==========================================
# 2. DATABASE MODELS (PostGIS Schema)
# ==========================================
class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String, index=True)
    risk_score = Column(Float)
    status = Column(String, default="PENDING_OFFICER") # PENDING_OFFICER, ESCALATED_DGM, RESOLVED
    created_at = Column(DateTime, default=datetime.utcnow)
    sla_deadline = Column(DateTime)
    
    # PostGIS Spatial Column
    geometry = Column(Geometry(geometry_type='POLYGON', srid=4326))

# Create tables in Railway if they don't exist
Base.metadata.create_all(bind=engine)

# ==========================================
# 3. PYDANTIC SCHEMAS (API Contracts)
# ==========================================
class TriggerPayload(BaseModel):
    """Pair A sends this exactly to POST /api/v1/triggers"""
    location_name: str
    risk_score: float
    geojson_polygon: Dict[str, Any]  # The raw GeoJSON geometry object

# ==========================================
# 4. SLA ESCALATION ENGINE (APScheduler)
# ==========================================
def check_and_escalate_slas():
    """Background worker that runs every 60 seconds to catch expired SLAs."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        expired_alerts = db.query(Alert).filter(
            Alert.status == "PENDING_OFFICER",
            Alert.sla_deadline <= now
        ).all()
        
        for alert in expired_alerts:
            alert.status = "ESCALATED_DGM"
            print(f"SYSTEM ALERT: Escalated ID {alert.id} to DGM Administration.")
            
        if expired_alerts:
            db.commit()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background worker on server boot
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_and_escalate_slas, 'interval', seconds=60)
    scheduler.start()
    yield
    scheduler.shutdown()

# ==========================================
# 5. FASTAPI APPLICATION SETUP
# ==========================================
app = FastAPI(title="BHUNETRA Spatial API", lifespan=lifespan)

# Allow Pair C (Frontend) to fetch data without CORS blocks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 6. FASTAPI ENDPOINTS
# ==========================================

@app.post("/api/v1/triggers")
def ingest_trigger(payload: TriggerPayload, db: Session = Depends(get_db)):
    """Pair A (Data Pipeline) uses this to insert detected anomalies."""
    
    # Convert incoming GeoJSON directly to Shapely shape, then to PostGIS WKB
    shapely_geom = shape(payload.geojson_polygon)
    postgis_geom = from_shape(shapely_geom, srid=4326)
    
    # Set SLA to 48 hours from now
    deadline = datetime.utcnow() + timedelta(hours=48)
    
    new_alert = Alert(
        location_name=payload.location_name,
        risk_score=payload.risk_score,
        sla_deadline=deadline,
        geometry=postgis_geom
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    
    return {"status": "success", "alert_id": new_alert.id}

@app.get("/api/v1/alerts")
def get_alerts(db: Session = Depends(get_db)):
    """Pair C (Frontend) uses this to populate the Next.js/Leaflet map."""
    
    alerts = db.query(Alert).all()
    feature_collection = {"type": "FeatureCollection", "features": []}
    
    for alert in alerts:
        shapely_geom = to_shape(alert.geometry)
        geom_geojson = mapping(shapely_geom)
        
        feature = {
            "type": "Feature",
            "geometry": geom_geojson,
            "properties": {
                "id": alert.id,
                "location_name": alert.location_name,
                "risk_score": alert.risk_score,
                "status": alert.status,
                "sla_deadline": alert.sla_deadline.isoformat()
            }
        }
        feature_collection["features"].append(feature)
        
    return feature_collection

@app.post("/api/v1/simulate/advance-sla")
def advance_time(db: Session = Depends(get_db)):
    """The Demo "Time-Travel" Hack: Forces all pending SLAs to expire immediately."""
    
    past_time = datetime.utcnow() - timedelta(hours=49)
    
    db.query(Alert).filter(Alert.status == "PENDING_OFFICER").update(
        {"sla_deadline": past_time}
    )
    db.commit()
    
    check_and_escalate_slas()
    
    return {"status": "success", "message": "Time-travel activated. SLAs expired and escalated."}

# ==========================================
# 7. LOCAL SERVER RUNNER
# ==========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)