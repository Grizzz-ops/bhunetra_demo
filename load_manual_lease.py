import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from shapely.geometry import shape, MultiPolygon, Polygon
from datetime import datetime

load_dotenv()
raw_url = os.getenv("DATABASE_URL")
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(raw_url)

geojson_data = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [81.2403517, 18.6584773],
            [81.2357091, 18.6596221],
            [81.2347599, 18.6627639],
            [81.2306899, 18.6629946],
            [81.2281432, 18.6622263],
            [81.2257785, 18.6610501],
            [81.226117,  18.659351],
            [81.2289709, 18.6542583],
            [81.2289997, 18.6482639],
            [81.239048,  18.6448894],
            [81.243277,  18.6500112],
            [81.2407333, 18.6575735],
            [81.2403517, 18.6584773]
          ]
        ]
      }
    }
  ]
}

# ─────────────────────────────────────────────
# LEASE DETAILS
# Change these values to match your actual data
# ─────────────────────────────────────────────

# Two scenarios you can demo:

# Scenario A — Active lease (detection inside = LEGAL)
LEASE_STATUS  = "ACTIVE"
EXPIRY_DATE   = datetime(2028, 12, 31)  # Future date = still valid
LESSEE_NAME   = "BhuNetra Demo Active Lease"

# Scenario B — Expired lease (detection inside = ILLEGAL)
# Uncomment these three lines and comment Scenario A
# to demo how expired lease detection works
# LEASE_STATUS  = "EXPIRED"
# EXPIRY_DATE   = datetime(2022, 6, 30)   # Past date = expired
# LESSEE_NAME   = "BhuNetra Demo Expired Lease"

# ─────────────────────────────────────────────

count = 0

with engine.connect() as conn:
    for feature in geojson_data["features"]:

        geometry = shape(feature["geometry"])

        if isinstance(geometry, Polygon):
            geometry = MultiPolygon([geometry])

        wkt = geometry.wkt

        conn.execute(text("""
            INSERT INTO leases
                (source, lessee_name, mineral_type,
                 state, district, status,
                 expiry_date, geometry)
            VALUES
                (:source, :lessee, :mineral,
                 :state, :district, :status,
                 :expiry, ST_Multi(ST_GeomFromText(:wkt, 4326)))
        """), {
            "source":   "MANUAL",
            "lessee":   LESSEE_NAME,
            "mineral":  "UNKNOWN",
            "state":    "Chhattisgarh",
            "district": "Unknown",
            "status":   LEASE_STATUS,
            "expiry":   EXPIRY_DATE,
            "wkt":      wkt
        })

        count += 1

    conn.commit()

print(f"✅ Loaded {count} lease polygon into Railway")
print(f"   Status:  {LEASE_STATUS}")
print(f"   Expiry:  {EXPIRY_DATE.strftime('%d %b %Y')}")
print(f"   Lessee:  {LESSEE_NAME}")
print("")
print("How legal check will now work:")
print("")

if LEASE_STATUS == "ACTIVE":
    print("→ Detection INSIDE polygon  = LEGAL (valid active lease)")
    print("→ Detection OUTSIDE polygon = ILLEGAL (no lease exists)")

elif LEASE_STATUS == "EXPIRED":
    print("→ Detection INSIDE polygon  = ILLEGAL (lease expired)")
    print("→ Detection OUTSIDE polygon = ILLEGAL (no lease exists)")
    print("   Both are illegal — just different reasons")