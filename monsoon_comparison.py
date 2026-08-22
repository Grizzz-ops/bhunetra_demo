"""
BhuNetra — monsoon cloud-cover comparison figure (presentation slide).

Renders Sentinel-2 true-color RGB for 2024-07-03 (97.45% cloud cover --
deliberately downloaded WITHOUT the pipeline's usual cloud filter, since
the whole point here is to show the cloudy scene) side by side with the
Sentinel-1 SAR VV scene from the same day, to make the monsoon-season
optical-vs-SAR availability gap visible at a glance.

Does not touch the January 2020/2024 pipeline or its outputs -- separate
diagnostic script, separate output file.
"""
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import rasterio

import check_imagery as ci
import download_sentinel as ds

REAL_DATA_DIR = Path("real_data")
OUTPUT_PNG = REAL_DATA_DIR / "monsoon_comparison.png"

MONSOON_SCENE_DATE = "2024-07-03"
MONSOON_CLOUD_COVER_PCT = 97.45
S2_LABEL = f"Sentinel-2 Optical, {MONSOON_SCENE_DATE} ({MONSOON_CLOUD_COVER_PCT}% cloud)"
S1_LABEL = f"Sentinel-1 SAR, {MONSOON_SCENE_DATE} (usable)"
SUPTITLE = "Same site, same day — optical vs SAR during monsoon"
SUMMARY_TEXT = ("July-Aug 2024: 12 optical scenes, 0 usable (91-100% cloud) | "
                 "9 SAR scenes, 9 usable")

VV_FILE = REAL_DATA_DIR / "monsoon_test_vv.tif"
LEE_WINDOW = 9


def download_cloudy_rgb(connection, scene_date):
    """Download B04/B03/B02 for scene_date with NO cloud-cover property
    filter -- a deliberate diagnostic download of a known-cloudy scene,
    not the pipeline's normal cloud-filtered path."""
    paths = {}
    for band, name in [("B04", "red"), ("B03", "green"), ("B02", "blue")]:
        path = REAL_DATA_DIR / f"monsoon_{name}.tif"
        ds.download_band(connection, band, scene_date, path)  # properties=None -> no filter
        paths[name] = path
    return paths


def load_stretched(path):
    with rasterio.open(path) as src:
        arr = src.read(1).astype("float64")
    lo, hi = np.nanpercentile(arr, [2, 98])
    if hi <= lo:
        hi = lo + 1e-6
    stretched = (arr - lo) / (hi - lo)
    return np.clip(stretched, 0.0, 1.0)


def build_rgb(paths):
    r = load_stretched(paths["red"])
    g = load_stretched(paths["green"])
    b = load_stretched(paths["blue"])
    return np.dstack([r, g, b])


def build_sar_db(path):
    vv = ci.load_band_masked(str(path))
    db = ci.linear_to_db(vv)
    return ci.lee_filter(db, LEE_WINDOW)


def main():
    conn = ds.connect()
    rgb_paths = download_cloudy_rgb(conn, MONSOON_SCENE_DATE)
    rgb = build_rgb(rgb_paths)

    sar_db = build_sar_db(VV_FILE)

    fig, (ax_left, ax_right) = plt.subplots(1, 2, figsize=(14, 8))

    ax_left.imshow(rgb)
    ax_left.set_title(S2_LABEL, fontsize=12)
    ax_left.axis("off")

    im = ax_right.imshow(sar_db, cmap="gray")
    ax_right.set_title(S1_LABEL, fontsize=12)
    ax_right.axis("off")
    fig.colorbar(im, ax=ax_right, fraction=0.046, pad=0.04, label="VV (dB)")

    fig.suptitle(SUPTITLE, fontsize=16, weight="bold")
    fig.text(0.5, 0.04, SUMMARY_TEXT, ha="center", fontsize=11)

    fig.savefig(OUTPUT_PNG, dpi=150, bbox_inches="tight")
    print(f"Saved {OUTPUT_PNG}")


if __name__ == "__main__":
    main()
