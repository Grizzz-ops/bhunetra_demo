"""
BhuNetra — VIIRS Black Marble nighttime-lights downloader (NASA Earthdata)

Downloads the VNP46A4 ANNUAL nighttime-lights composite (NearNadir_Composite_
Snow_Free radiance) for BEFORE_YEAR and AFTER_YEAR over BBOX, reprojects to
EPSG:4326 to match the Sentinel-1/2 rasters, and saves as
real_data/before_ntl.tif / real_data/after_ntl.tif.

Annual (not daily/monthly) is used deliberately: it averages out cloud
cover, moonlight phase, and seasonal variation, which matters here because
we're comparing across years (2020 vs 2024), not across nights.

Resolution note: VIIRS is ~500m/pixel native. This bbox (~2.6km x 2.2km) is
expected to produce a very coarse raster (roughly 5x4 pixels) -- that is
correct, not a bug. Do not widen the bbox to "fix" this; it would stop
matching the Sentinel-1/2 AOI.

Auth: reads EARTHDATA_TOKEN from .env (NASA Earthdata bearer token, from
https://urs.earthdata.nasa.gov/profile -> Generate Token). If the token is
invalid/expired, blackmarble raises a ValueError about an "HTML response"
(the download silently redirected to a login page instead of data) --
that's an auth problem to fix on the Earthdata profile, not a code bug.
"""
import os
from datetime import date
from pathlib import Path

import geopandas as gpd
import rasterio
from dotenv import load_dotenv
from shapely.geometry import box

from blackmarble.raster import bm_raster
from blackmarble.types import Product

# ---- config -----------------------------------------------------------
BBOX = {"west": 81.22, "south": 18.65, "east": 81.245, "north": 18.67}
BEFORE_YEAR = 2020
AFTER_YEAR  = 2024
VARIABLE    = "NearNadir_Composite_Snow_Free"  # VNP46A4 default radiance layer
OUTPUT_DIR  = Path("real_data")


def load_token():
    load_dotenv()
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token:
        raise RuntimeError("EARTHDATA_TOKEN not set -- add it to .env (see docstring).")
    return token


def roi_geodataframe():
    geom = box(BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"])
    return gpd.GeoDataFrame(geometry=[geom], crs="EPSG:4326")


def download_ntl(token, year, out_path):
    ds = bm_raster(
        roi_geodataframe(),
        product_id=Product.VNP46A4,
        date_range=date(year, 1, 1),
        token=token,
        variable=VARIABLE,
    )

    # Diagnostic: print the actual structure once, in case the real return
    # shape/variable naming differs slightly from what's assumed below --
    # this call path couldn't be fully exercised against a valid token
    # before writing this script.
    print(f"  [debug] Dataset for {year}: dims={dict(ds.sizes)}, "
          f"data_vars={list(ds.data_vars)}")

    da = ds[VARIABLE]
    # Collapse any singleton non-spatial dims (e.g. a length-1 time axis
    # from requesting a single date) down to a plain 2D (y, x) array.
    da = da.squeeze(drop=True)

    if da.rio.crs is None:
        da = da.rio.write_crs("EPSG:4326")
    da = da.rio.reproject("EPSG:4326")

    OUTPUT_DIR.mkdir(exist_ok=True)
    da.rio.to_raster(str(out_path))


def report(out_path, year):
    with rasterio.open(out_path) as src:
        arr = src.read(1)
        print(
            f"  {out_path}  |  year {year}  |  {src.width}x{src.height} px  |  "
            f"CRS {src.crs}  |  radiance min={arr.min():.3f} max={arr.max():.3f}"
        )


if __name__ == "__main__":
    token = load_token()

    before_path = OUTPUT_DIR / "before_ntl.tif"
    after_path  = OUTPUT_DIR / "after_ntl.tif"

    print(f"Downloading VNP46A4 annual composite for {BEFORE_YEAR}...")
    download_ntl(token, BEFORE_YEAR, before_path)
    report(before_path, BEFORE_YEAR)

    print(f"\nDownloading VNP46A4 annual composite for {AFTER_YEAR}...")
    download_ntl(token, AFTER_YEAR, after_path)
    report(after_path, AFTER_YEAR)

    print("\nDone -- expect a very coarse raster (~5x4 px) given VIIRS's "
          "~500m resolution vs this bbox's ~2.6km x 2.2km extent. That's "
          "correct, not a bug.")
