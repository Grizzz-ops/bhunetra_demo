"""
BhuNetra -- DBSCAN site clustering (B3).

Groups Alert rows into physical mining sites by spatial proximity, writing
the cluster label to Alert.cluster_id. This is DISTINCT from site_id,
which the pipeline sets to the AOI identifier (e.g. "AOI-07-BALAGHAT") --
the same value on every row for that AOI. cluster_id is the physical
grouping *within* an AOI: several nearby but physically separate
excavation fronts inside one AOI should land in different clusters. This
script never touches site_id.

Parameters (eps=400 meters, min_samples=1) were validated by hand against
the real 9 Bailadila triggers, not tuned blind:
  - 350m -> 5 sites (over-splits)
  - 400m -> 4 sites   <- stable plateau starts here
  - 450m -> 4 sites   <- same partition as 400m
  - 500m -> starts merging across the lease boundary
  - 600m -> collapses everything into 1 site
min_samples=1 is required because an isolated detection must still become
its own site -- DBSCAN's default noise label (-1) would otherwise drop it
from the site view entirely, which is wrong for a regulatory tool (every
alert must belong to some site).

Run manually, not part of the request path: `python db/cluster_sites.py`
Re-run after ingesting new triggers -- new alerts start with cluster_id
NULL and are invisible to GET /api/v1/sites until this has run.
"""
import sys
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from geoalchemy2.shape import to_shape
from sklearn.cluster import DBSCAN

# This script lives in db/, but Alert/SessionLocal are defined in main.py
# at the repo root -- add the repo root to sys.path so the import below
# resolves after the move.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from main import Alert, SessionLocal  # noqa: E402 (must follow the sys.path fix above)

EPS_METERS = 400
MIN_SAMPLES = 1
EARTH_METERS_PER_DEG_LAT = 111320.0  # same approximation used throughout this codebase


def to_local_meters(lons, lats):
    """Projects lon/lat degrees to meters on a flat plane centered on the
    mean of the points being clustered. DBSCAN on raw degrees is wrong: a
    degree of longitude is shorter than a degree of latitude away from the
    equator, so eps=400 would mean different real distances in x vs y."""
    lat_mean = sum(lats) / len(lats)
    lon_mean = sum(lons) / len(lons)
    return np.array([
        [
            (lon - lon_mean) * EARTH_METERS_PER_DEG_LAT * np.cos(np.radians(lat_mean)),
            (lat - lat_mean) * EARTH_METERS_PER_DEG_LAT,
        ]
        for lon, lat in zip(lons, lats)
    ])


def main():
    db = SessionLocal()
    try:
        alerts = db.query(Alert).filter(Alert.geometry.isnot(None)).all()
        if not alerts:
            print("No alerts with geometry found -- nothing to cluster.")
            return

        lons, lats = [], []
        for alert in alerts:
            centroid = to_shape(alert.geometry).centroid
            lons.append(centroid.x)
            lats.append(centroid.y)

        xy = to_local_meters(lons, lats)
        labels = DBSCAN(eps=EPS_METERS, min_samples=MIN_SAMPLES).fit_predict(xy)

        by_cluster = {}
        for alert, label in zip(alerts, labels):
            alert.cluster_id = int(label)
            by_cluster.setdefault(int(label), []).append(alert.id)
        db.commit()

        print(f"Clustered {len(alerts)} alert(s) into {len(by_cluster)} site(s) "
              f"(eps={EPS_METERS}m, min_samples={MIN_SAMPLES}).")
        for cluster_id in sorted(by_cluster):
            print(f"  cluster_id={cluster_id}: alert_ids={by_cluster[cluster_id]}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
