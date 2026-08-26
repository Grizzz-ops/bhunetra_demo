"""
Generates synthetic 'before' and 'after' Red + NIR band rasters, plus a
sample lease-boundary polygon, so you can run and test the full detection
pipeline TODAY -- before real Sentinel-2 imagery is downloaded.

Swap-in point for real data: once you have real Sentinel-2 scenes, replace
the two GeoTIFFs this script writes (before_red.tif / before_nir.tif /
after_red.tif / after_nir.tif) with your real downloaded bands, using the
SAME filenames, and detection.py needs zero changes.
"""
import numpy as np
import rasterio
from rasterio.transform import from_origin
import geopandas as gpd
from shapely.geometry import Polygon

OUT = "sample_data"
SIZE = 200                     # 200x200 pixel demo scene
PIXEL_DEG = 0.0001              # ~11m pixel size at this latitude

# Roughly centered on a real MP mining-belt coordinate (Balaghat area)
ORIGIN_LON, ORIGIN_LAT = 80.150, 21.850
transform = from_origin(ORIGIN_LON, ORIGIN_LAT, PIXEL_DEG, PIXEL_DEG)

rng = np.random.default_rng(42)

def write_band(path, arr):
    with rasterio.open(
        path, "w", driver="GTiff", height=SIZE, width=SIZE, count=1,
        dtype=arr.dtype, crs="EPSG:4326", transform=transform,
    ) as dst:
        dst.write(arr, 1)

# --- BEFORE scene: healthy vegetation baseline ---
before_red = (rng.normal(60, 5, (SIZE, SIZE))).clip(0, 255).astype("uint8")
before_nir = (rng.normal(180, 8, (SIZE, SIZE))).clip(0, 255).astype("uint8")  # high NIR = vegetation

# --- AFTER scene: same baseline + two disturbance patches ---
after_red = before_red.copy()
after_nir = before_nir.copy()

# Patch 1: NEW illegal site, OUTSIDE the lease boundary (rows 20-45, cols 30-55)
after_red[20:45, 30:55] = rng.normal(140, 6, (25, 25)).clip(0, 255).astype("uint8")   # bare soil = high red
after_nir[20:45, 30:55] = rng.normal(70, 6, (25, 25)).clip(0, 255).astype("uint8")    # bare soil = low NIR

# Patch 2: lease EXPANSION, INSIDE the lease boundary (rows 120-150, cols 110-140)
after_red[120:150, 110:140] = rng.normal(135, 6, (30, 30)).clip(0, 255).astype("uint8")
after_nir[120:150, 110:140] = rng.normal(75, 6, (30, 30)).clip(0, 255).astype("uint8")

write_band(f"{OUT}/before_red.tif", before_red)
write_band(f"{OUT}/before_nir.tif", before_nir)
write_band(f"{OUT}/after_red.tif", after_red)
write_band(f"{OUT}/after_nir.tif", after_nir)

# --- Sample lease boundary polygon (covers the "inside" patch, NOT the "outside" one) ---
def px_to_lonlat(row, col):
    lon, lat = rasterio.transform.xy(transform, row, col)
    return lon, lat

corners = [(100, 100), (100, 160), (160, 160), (160, 100)]  # (row, col) rectangle
poly_coords = [px_to_lonlat(r, c) for r, c in corners]
lease = gpd.GeoDataFrame(
    {"lease_id": ["ML-MP-0417"], "holder": ["Demo Lease Pvt Ltd"]},
    geometry=[Polygon(poly_coords)],
    crs="EPSG:4326",
)
lease.to_file(f"{OUT}/lease_boundaries.geojson", driver="GeoJSON")

print("Sample data written to sample_data/")
print(" - before_red.tif / before_nir.tif  (baseline scene)")
print(" - after_red.tif  / after_nir.tif   (scene with 2 disturbance patches)")
print(" - lease_boundaries.geojson         (1 lease polygon)")
print("\nGround truth for this synthetic scene:")
print(" - Patch 1 (rows 20-45, cols 30-55)   -> OUTSIDE lease -> should flag as VIOLATION")
print(" - Patch 2 (rows 120-150, cols 110-140) -> INSIDE lease  -> should flag as EXPANSION")
