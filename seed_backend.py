"""
BhuNetra — seed the live backend (Railway) with our real Bailadila triggers.

Reads output/triggers_scored.json and POSTs each of the 9 triggers to
POST /api/v1/triggers on the live backend, in the exact schema main.py's
TriggerPayload expects:

    class TriggerPayload(BaseModel):
        location_name: str
        risk_score: float
        geojson_polygon: Dict[str, Any]  # raw GeoJSON geometry, not a Feature

SCALE NOTE (flagged explicitly, not assumed): main.py's TriggerPayload
declares risk_score as a bare `float` -- nothing in the schema enforces a
0-1 or 0-100 range. The existing live sample data ("Sample Region Alpha",
"Singrauli Test Site") uses 0-100 (confirmed by querying GET /api/v1/alerts
directly: risk_score 92.5 and 91.0), while our confidence_score is 0-1
(range 0.292-0.506 for these 9 triggers). This script converts by
multiplying by 100 so new alerts don't display as broken outliers next to
the existing samples -- that's a judgment call based on observed data, not
something the backend schema requires or validates.

Only ADDS new alerts via POST -- never touches the 2 existing sample rows.

Safety: defaults to a dry run (prints payloads, sends nothing). Pass --live
to actually POST.
"""
import argparse
import json
import math

import requests

TRIGGERS_FILE = "output/triggers_scored.json"
API_BASE_URL = "https://bhunetrademo-production.up.railway.app"
TRIGGERS_ENDPOINT = f"{API_BASE_URL}/api/v1/triggers"

SITE_LABEL = "Bailadila AOI-07"
RISK_SCORE_SCALE = 100  # confidence_score (0-1) * this -> matches live sample data's 0-100 convention

# Same local-latitude degree-to-meter approximation used elsewhere in this
# project (disturbance_area_m2, nearest_road) -- not a full geodesic
# reprojection, but consistent with how the rest of the codebase handles this.
EARTH_METERS_PER_DEG_LAT = 111320.0
POLYGON_HALF_SIDE_M = 50  # ~100m per side


def square_polygon(lat, lon, half_side_m=POLYGON_HALF_SIDE_M):
    """Raw GeoJSON Polygon geometry (no Feature wrapper) -- a closed ring
    approximately half_side_m*2 meters per side, centered on (lat, lon)."""
    meters_per_deg_lon = EARTH_METERS_PER_DEG_LAT * math.cos(math.radians(lat))
    dlat = half_side_m / EARTH_METERS_PER_DEG_LAT
    dlon = half_side_m / meters_per_deg_lon

    ring = [
        [lon - dlon, lat - dlat],
        [lon + dlon, lat - dlat],
        [lon + dlon, lat + dlat],
        [lon - dlon, lat + dlat],
        [lon - dlon, lat - dlat],  # closed ring, first == last
    ]
    return {"type": "Polygon", "coordinates": [ring]}


def build_payload(trigger):
    return {
        "location_name": f"{SITE_LABEL} — {trigger['trigger_id']}",
        "risk_score": round(trigger["confidence_score"] * RISK_SCORE_SCALE, 1),
        "geojson_polygon": square_polygon(trigger["lat"], trigger["lon"]),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true",
                         help="Actually POST to the backend. Without this flag, dry-run only.")
    args = parser.parse_args()

    triggers = json.load(open(TRIGGERS_FILE))
    payloads = [build_payload(t) for t in triggers]

    if not args.live:
        print(f"DRY RUN -- {len(payloads)} payload(s) that WOULD be POSTed to {TRIGGERS_ENDPOINT}. "
              f"Nothing sent. Re-run with --live to actually send.\n")
        for p in payloads:
            print(json.dumps(p, indent=2))
            print()
        return

    print(f"Sending {len(payloads)} trigger(s) to {TRIGGERS_ENDPOINT} ...\n")
    for p in payloads:
        resp = requests.post(TRIGGERS_ENDPOINT, json=p, timeout=30)
        print(f"  {p['location_name']}  ->  HTTP {resp.status_code}  {resp.text}")


if __name__ == "__main__":
    main()
