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
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from geoalchemy2 import Geometry
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import shape, mapping
from apscheduler.schedulers.background import BackgroundScheduler

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy import JSON
from datetime import datetime, timezone, timedelta

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
    
    # PostGIS Spatial Column
    geometry = Column(Geometry(geometry_type='POLYGON', srid=4326))
    legal_status  = Column(String, default="UNCHECKED")
    legal_reason  = Column(String, nullable=True)
    legal_weight  = Column(Float, default=0.0)

    # -------------------------------------------------------------
    # NEW WIDENED COLUMNS (Add these fields):
    # -------------------------------------------------------------
    trigger_id = Column(String, nullable=True)
    site_id = Column(Integer, nullable=True)
    confidence_score = Column(Float, nullable=True)
    confidence_tier = Column(String, nullable=True)
    boundary_status = Column(String, nullable=True)
    sar_change_score = Column(Float, nullable=True)
    disturbance_area_m2 = Column(Float, nullable=True)
    ntl_delta = Column(Float, nullable=True)
    legality_flag = Column(String, nullable=True)
    legality_assessment = Column(JSON, nullable=True)

# Create tables in Railway if they don't exist
Base.metadata.create_all(bind=engine)

# ==========================================
# 3. PYDANTIC SCHEMAS (API Contracts)
# ==========================================
from pydantic import BaseModel
from typing import Optional, Dict, Any

class TriggerPayload(BaseModel):
    location_name: str
    risk_score: float  # Kept for backward compatibility
    geojson_polygon: dict
    
    # NEW WIDENED FIELDS:
    trigger_id: Optional[str] = None
    site_id: Optional[int] = None
    confidence_score: Optional[float] = None
    confidence_tier: Optional[str] = None
    boundary_status: Optional[str] = None
    sar_change_score: Optional[float] = None
    disturbance_area_m2: Optional[float] = None
    ntl_delta: Optional[float] = None
    legality_flag: Optional[str] = None
    legality_assessment: Optional[Dict[str, Any]] = None

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

def run_legal_check(centroid_wkt: str, db: Session):
    """
    Checks if a detected coordinate is inside
    any legal lease boundary in our database.
    
    centroid_wkt = the center point of the
    detected mining area, as text coordinates
    """
    
    # Ask PostGIS: is this point inside any lease polygon?
    # ST_Contains is a PostGIS spatial function
    # It returns the lease record if found, nothing if not
    result = db.execute(text("""
        SELECT 
            id,
            source,
            lessee_name,
            status,
            expiry_date
        FROM leases
        WHERE ST_Contains(
            geometry,
            ST_GeomFromEWKT(:centroid)
        )
        LIMIT 1;
    """), {"centroid": centroid_wkt}).fetchone()
    
    # No lease found anywhere near this point
    if result is None:
        return {
            "legal_status": "ILLEGAL",
            "legal_reason": "No mining lease or licence exists at this coordinate — MMDR Act Section 21 violation",
            "legal_weight": 1.0
        }
    
    # A lease was found — now check if it's still valid
    is_expired = (
        result.status in ["EXPIRED", "CANCELLED", "LAPSED"]
        or
        (result.expiry_date and result.expiry_date < datetime.utcnow())
    )
    
    if is_expired:
        return {
            "legal_status": "ILLEGAL",
            "legal_reason": f"Lease held by {result.lessee_name or 'Unknown'} has expired — MMDR Act Section 21 violation",
            "legal_weight": 0.85
        }
    
    # Lease found but status is UNKNOWN
    # This happens when data comes from Maus or OSM
    # which don't have official status information
    if result.status == "UNKNOWN":
        return {
            "legal_status": "SUSPECTED",
            "legal_reason": f"Mining area found in {result.source} dataset — lease status unverified. Requires IBM MTS confirmation",
            "legal_weight": 0.60
        }
    
    # All checks passed — this looks like legal mining
    return {
        "legal_status": "LEGAL",
        "legal_reason": f"Valid active lease confirmed — {result.lessee_name or 'Unknown'}",
        "legal_weight": 0.0
    }
# ==========================================
# 6. FASTAPI ENDPOINTS
# ==========================================

@app.post("/api/v1/triggers")
def ingest_trigger(payload: TriggerPayload, db: Session = Depends(get_db)):
    """
    Pair A sends detections here.
    Now includes automatic legal check before saving.
    """
    
    # ─────────────────────────────────────────────
    # PART 1: Convert Pair A's GeoJSON into
    # a format PostGIS understands
    # Same as before — don't change this logic
    # ─────────────────────────────────────────────
    shapely_geom = shape(payload.geojson_polygon)
    postgis_geom = from_shape(shapely_geom, srid=4326)
    
    # ─────────────────────────────────────────────
    # PART 2: Get the CENTER POINT of the
    # detected polygon
    #
    # Why center point?
    # The legal check works best on one specific point
    # The center of the detected area is the most
    # representative single point to check
    # ─────────────────────────────────────────────
    centroid      = shapely_geom.centroid
    centroid_ewkt = f"SRID=4326;POINT({centroid.x} {centroid.y})"
    
    # ─────────────────────────────────────────────
    # PART 3: Run the legal check
    # This calls the function we wrote in Step 2
    # Returns legal_status, legal_reason, legal_weight
    # ─────────────────────────────────────────────
    legal_result  = run_legal_check(centroid_ewkt, db)
    
    legal_status  = legal_result["legal_status"]
    legal_reason  = legal_result["legal_reason"]
    legal_weight  = legal_result["legal_weight"]
    
    # ─────────────────────────────────────────────
    # PART 4: Calculate final confidence score
    #
    # Why combine scores?
    # Pair A gives us risk_score (satellite signals)
    # Legal check gives us legal_weight
    # Combining both gives a more accurate final score
    #
    # Formula:
    # 40% comes from legal check
    # 60% comes from Pair A's satellite score
    # ─────────────────────────────────────────────
    satellite_score  = payload.risk_score / 100.0
    
    final_confidence = (
        0.40 * legal_weight     +
        0.60 * satellite_score
    )
    
    # ─────────────────────────────────────────────
    # PART 5: If clearly legal — stop here
    # Don't create an alert for legal mining
    # Tell Pair A it was ignored and why
    # ─────────────────────────────────────────────
    if legal_status == "LEGAL":
        return {
            "status":  "no_alert_raised",
            "reason":  legal_reason,
            "message": "Valid lease confirmed — detection filtered out"
        }
    
    # ─────────────────────────────────────────────
    # PART 6: Save the alert with legal info
    # Only reaches here if ILLEGAL or SUSPECTED
    # ─────────────────────────────────────────────
    deadline = datetime.now(timezone.utc) + timedelta(hours=48)
    
    new_alert = Alert(
        location_name       = payload.location_name,
        risk_score          = round(final_confidence * 100, 1),
        sla_deadline        = deadline,
        geometry            = postgis_geom,
        legal_status        = legal_status,
        legal_reason        = legal_reason,
        legal_weight        = legal_weight,

        # Pass widened payload fields into PostgreSQL
        trigger_id          = payload.trigger_id,
        site_id             = payload.site_id,
        confidence_score    = payload.confidence_score or round(final_confidence * 100, 1),
        confidence_tier     = payload.confidence_tier,
        boundary_status     = payload.boundary_status,
        sar_change_score    = payload.sar_change_score,
        disturbance_area_m2 = payload.disturbance_area_m2,
        ntl_delta           = payload.ntl_delta,
        legality_flag       = payload.legality_flag or legal_status,
        legality_assessment = payload.legality_assessment
    )
    db.add(new_alert)
    db.flush()
    # ─────────────────────────────────────────────
    # PART 7: Write to audit log
    # Permanent record that this trigger was raised
    # and what the legal check found
    # ─────────────────────────────────────────────
    db.add(AuditLog(
        alert_id   = new_alert.id,
        action     = "TRIGGER_RAISED",
        new_status = "PENDING_OFFICER",
        notes      = f"Legal: {legal_status} | {legal_reason} | Confidence: {round(final_confidence * 100, 1)}%"
    ))
    
    db.commit()
    db.refresh(new_alert)
    
    return {
        "status":           "alert_raised",
        "alert_id":         new_alert.id,
        "legal_status":     legal_status,
        "legal_reason":     legal_reason,
        "confidence_score": round(final_confidence * 100, 1)
    }

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
                "sla_deadline": alert.sla_deadline.isoformat(),
                # ADD THESE THREE
                "legal_status":  alert.legal_status  or "UNCHECKED",
                "legal_reason":  alert.legal_reason  or "Pending verification",
                "legal_weight":  alert.legal_weight  or 0.0
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

@app.get("/api/v1/leases")
def get_lease_boundaries(db: Session = Depends(get_db)):
    """
    Returns all lease boundary polygons as GeoJSON.
    
    Why GeoJSON?
    Because Leaflet (Pair C's map library) reads 
    GeoJSON directly — no conversion needed.
    
    Pair C uses this to draw green polygons on 
    the map showing where mining IS legally allowed.
    """
    
    # Ask database for all lease records
    # ST_AsGeoJSON converts PostGIS geometry
    # into standard GeoJSON text that Pair C can use
    leases = db.execute(text("""
        SELECT 
            id,
            source,
            lessee_name,
            mineral_type,
            status,
            ST_AsGeoJSON(geometry) as geom_json
        FROM leases
        LIMIT 500;
    """)).fetchall()
    
    # Build a GeoJSON FeatureCollection
    # This is the standard format Leaflet expects
    feature_collection = {
        "type": "FeatureCollection",
        "features": []
    }
    
    import json
    
    for lease in leases:
        feature = {
            "type": "Feature",
            "geometry": json.loads(lease.geom_json),
            "properties": {
                "id":           lease.id,
                "source":       lease.source,
                "lessee_name":  lease.lessee_name,
                "mineral_type": lease.mineral_type,
                "status":       lease.status,
                "layer_type":   "legal_lease_boundary"
            }
        }
        feature_collection["features"].append(feature)
    
    return feature_collection
# ==========================================
# 7. LOCAL SERVER RUNNER
# ==========================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)