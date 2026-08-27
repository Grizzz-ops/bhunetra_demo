"""
BhuNetra -- Detection Engine, MineNetCD variant.

Same trigger schema and downstream contract as detection.py, but the
change_mask comes from ericyu/minenetcd-upernet-Swin-Diff-B-Pretrained
instead of an NDVI threshold. Everything from "cluster changed pixels"
onward is untouched and imported straight from detection.py, so this
plugs into the same score_triggers.py / seed_backend.py stages.

Requires the ML-only virtualenv (torch/transformers/timm -- see
requirements-ml.txt). Run with:

    <ml-venv>/Scripts/python.exe pipeline/detection_minenetcd.py
    # or against a different before/after pair (same file-naming convention):
    <ml-venv>/Scripts/python.exe pipeline/detection_minenetcd.py --data-dir real_data_2026 --output output/triggers_2026_minenetcd.json

READ pipeline/minenetcd_infer.py's module docstring before trusting this
output -- there's a real resolution mismatch (our Sentinel-2 scene is
lower-resolution and smaller than a training patch) and a missing-Green-
band approximation baked into the RGB composite. This is an experimental
detector, not a validated replacement for detection.py's NDVI approach,
until checked against known real Bailadila changes.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone

import cv2
import geopandas as gpd
import rasterio
from shapely.geometry import Point

from detection import (
    LEASE_FILE, LEASE_BOUNDARY_VALID_FOR_SITE, SITE_ID,
    MIN_BLOB_AREA_PX,
    load_band, pixel_to_lonlat,
)
from minenetcd_infer import build_rgb_composite, detect_change_mask

EARTH_METERS_PER_DEG_LAT = 111320.0


def pixel_size_meters(raster_path):
    """Average ground sample distance of a raster in meters/pixel, computed
    from its CRS-degree resolution + center latitude (longitude degrees are
    shorter than latitude degrees away from the equator -- cos(lat) scales
    that). Assumes EPSG:4326, which is what every real_data/*.tif here is."""
    with rasterio.open(raster_path) as src:
        res_x_deg, res_y_deg = src.res
        center_lat = (src.bounds.top + src.bounds.bottom) / 2
    res_x_m = res_x_deg * EARTH_METERS_PER_DEG_LAT * math.cos(math.radians(center_lat))
    res_y_m = res_y_deg * EARTH_METERS_PER_DEG_LAT
    return (res_x_m + res_y_m) / 2


def run_detection(data_dir="real_data"):
    before_red_path = f"{data_dir}/before_red.tif"
    before_red, transform = load_band(before_red_path)
    before_nir, _ = load_band(f"{data_dir}/before_nir.tif")
    before_blue, _ = load_band(f"{data_dir}/before_blue.tif")
    after_red, _ = load_band(f"{data_dir}/after_red.tif")
    after_nir, _ = load_band(f"{data_dir}/after_nir.tif")
    after_blue, _ = load_band(f"{data_dir}/after_blue.tif")

    before_rgb = build_rgb_composite(before_red, before_nir, before_blue)
    after_rgb = build_rgb_composite(after_red, after_nir, after_blue)

    source_gsd_m = pixel_size_meters(before_red_path)
    print(f"Source imagery: ~{source_gsd_m:.2f}m/px (vs ~1.2m/px the model trained on)")
    print("Running ericyu/minenetcd-upernet-Swin-Diff-B-Pretrained inference "
          "(scale-matched tiling)...")
    change_mask = detect_change_mask(before_rgb, after_rgb, source_gsd_m)
    print(f"Model flagged {int(change_mask.sum())} / {change_mask.size} pixels as changed "
          f"({100 * change_mask.sum() / change_mask.size:.2f}%).")

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(change_mask, connectivity=8)

    lease_gdf = gpd.read_file(LEASE_FILE) if LEASE_BOUNDARY_VALID_FOR_SITE else None

    triggers = []
    for label_id in range(1, num_labels):
        area = stats[label_id, cv2.CC_STAT_AREA]
        if area < MIN_BLOB_AREA_PX:
            continue

        cx, cy = centroids[label_id]
        lon, lat = pixel_to_lonlat(transform, cy, cx)

        blob_mask = labels == label_id
        # No NDVI-drop magnitude here (the model outputs a binary mask, not
        # a continuous score) -- change_pct reports the blob's areal share
        # of the scene instead, so the trigger schema field is populated
        # with *something* meaningful rather than a fabricated number.
        change_pct = round(100 * blob_mask.sum() / change_mask.size, 2)

        if LEASE_BOUNDARY_VALID_FOR_SITE:
            point = Point(lon, lat)
            inside_lease = lease_gdf.contains(point).any()
            boundary_status = "within_lease_expansion" if inside_lease else "boundary_violation"
        else:
            boundary_status = "NOT_EVALUATED_NO_LEASE_BOUNDARY_FOR_SITE"

        px_row, px_col = int(round(cy)), int(round(cx))
        id_seed = f"{SITE_ID}-minenetcd-{px_row}-{px_col}"

        trigger = {
            "trigger_id": "MNC-" + hashlib.md5(id_seed.encode()).hexdigest()[:6].upper(),
            "site_id": SITE_ID,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "change_pct": change_pct,
            "area_px": int(area),
            "boundary_status": boundary_status,
            "detected_at": datetime.now(timezone.utc).isoformat(),
            "source": "ericyu/minenetcd-upernet-Swin-Diff-B-Pretrained (experimental -- see module docstring)",
            "status": "PENDING_SCORING",
        }
        triggers.append(trigger)

    return triggers


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="real_data",
                         help="folder with before/after_{red,nir,blue}.tif (default: real_data)")
    parser.add_argument("--output", default="output/triggers_minenetcd.json")
    args = parser.parse_args()

    results = run_detection(data_dir=args.data_dir)
    with open(args.output, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nDetected {len(results)} candidate trigger(s):\n")
    for t in results:
        print(f"  {t['trigger_id']}  |  {t['boundary_status']:24s}  |  "
              f"area_share={t['change_pct']}%  |  ({t['lat']}, {t['lon']})")
    print(f"\nWritten to {args.output}.")
