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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from geoalchemy2 import Geometry
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import shape, mapping
from apscheduler.schedulers.background import BackgroundScheduler

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException

# ==========================================
# 1. CONFIGURATION & RAILWAY TRAP FIX
# ==========================================
# Railway connection strings start with 'postgres://', but SQLAlchemy requires 'postgresql://'.
raw_db_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/postgres")
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    raw_db_url,
    pool_pre_ping=True,  # Checks if the connection is alive before querying
    pool_recycle=300     # Automatically refreshes connections every 5 minutes
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Lease(Base):
    __tablename__ = "leases"
    id              = Column(Integer, primary_key=True, index=True)
    source          = Column(String)
    lessee_name     = Column(String)
    mineral_type    = Column(String)
    state           = Column(String)
    district        = Column(String)
    status          = Column(String, default="UNKNOWN")
    expiry_date     = Column(DateTime, nullable=True)
    geometry        = Column(Geometry(geometry_type='MULTIPOLYGON', srid=4326))


class Officer(Base):
    __tablename__ = "officers"
    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String, nullable=False)
    email           = Column(String, unique=True, nullable=False, index=True)
    password_hash   = Column(String, nullable=False)
    role            = Column(String, nullable=False)
    district        = Column(String, nullable=True)
    state           = Column(String, nullable=True)
    fcm_token       = Column(String, nullable=True)
    is_active       = Column(Integer, default=1)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id              = Column(Integer, primary_key=True, index=True)
    alert_id        = Column(Integer, nullable=False)
    officer_id      = Column(Integer, nullable=True)
    previous_status = Column(String, nullable=True)
    new_status      = Column(String, nullable=True)
    action          = Column(String, nullable=False)
    notes           = Column(String, nullable=True)
    timestamp       = Column(DateTime, default=datetime.utcnow)
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
    trigger_id = Column(String, unique=True, index=True)
    site_id = Column(String)
    change_pct = Column(Float)
    boundary_status = Column(String) 
    sar_change_score = Column(Float) 
    sar_mean_abs_change_db = Column(Float) 
    confidence_score = Column(Float) 
    confidence_tier = Column(String) 
    disturbance_area_m2 = Column(Float) 
    ntl_delta = Column(Float) 
    legality_flag = Column(String) 
    legality_assessment = Column(JSONB)
    
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
    geojson_polygon: Dict[str,Any]  
    trigger_id: str
    site_id: str
    change_pct: float
    boundary_status: str
    sar_change_score: float | None = None    # optional — SAR can be unavailable
    sar_mean_abs_change_db: float | None = None    
    confidence_score: float | None = None           
    ntl_delta: float | None = None                    
    disturbance_area_m2: float
    confidence_tier: str
    legality_flag: str
    legality_assessment: Dict[str, Any]   

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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = os.getenv("JWT_SECRET", "bhunetra_secret_key_2026")
JWT_ALGORITHM = "HS256"

def create_token(officer_id: int, role: str, state: str) -> str:
    payload = {
        "officer_id": officer_id,
        "role": role,
        "state": state or "",
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_officer(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please log in again."
        )
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
    geometry=postgis_geom,
    trigger_id=payload.trigger_id,
    site_id=payload.site_id,
    change_pct=payload.change_pct,
    boundary_status=payload.boundary_status,
    sar_change_score=payload.sar_change_score,
    sar_mean_abs_change_db=payload.sar_mean_abs_change_db,
    confidence_score=payload.confidence_score,
    confidence_tier=payload.confidence_tier,
    disturbance_area_m2=payload.disturbance_area_m2,
    ntl_delta=payload.ntl_delta,
    legality_flag=payload.legality_flag,
    legality_assessment=payload.legality_assessment,
    )
    db.add(new_alert)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"Trigger {payload.trigger_id} already ingested")

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

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/v1/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    officer = db.query(Officer).filter(
        Officer.email == request.email,
        Officer.is_active == 1
    ).first()

    if not officer or not pwd_context.verify(
        request.password, officer.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    token = create_token(
        officer_id=officer.id,
        role=officer.role,
        state=officer.state
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": officer.role,
        "name": officer.name
    }

class AlertActionRequest(BaseModel):
    new_status: str
    notes: str

@app.patch("/api/v1/alerts/{alert_id}/action")
def officer_action(
    alert_id: int,
    request: AlertActionRequest,
    db: Session = Depends(get_db),
    current_officer: dict = Depends(get_current_officer)
):
    # Find the alert in database
    alert = db.query(Alert).filter(Alert.id == alert_id).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Remember what status it was before changing
    previous_status = alert.status

    # Update the status
    alert.status = request.new_status

    # Write to audit log — permanent record of this action
    db.add(AuditLog(
        alert_id=alert_id,
        officer_id=current_officer["officer_id"],
        action="STATUS_UPDATED",
        previous_status=previous_status,
        new_status=request.new_status,
        notes=request.notes,
        timestamp=datetime.utcnow()
    ))

    db.commit()

    return {
        "status": "updated",
        "alert_id": alert_id,
        "previous_status": previous_status,
        "new_status": request.new_status,
        "updated_by": current_officer["officer_id"]
    }
# ==========================================
# 7. LOCAL SERVER RUNNER
# ==========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)