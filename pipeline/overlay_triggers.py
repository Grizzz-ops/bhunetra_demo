"""
BhuNetra — visual sanity check for detected triggers.

Plots the "after" NDVI map with each trigger from output/triggers.json
overlaid at its pixel location, so you can eyeball whether each detection
sits on a real disturbed patch or on unrelated forest (a likely false
positive).
"""
import json

import matplotlib.pyplot as plt
import rasterio

REAL_DATA_DIR  = "real_data"
TRIGGERS_FILE  = "output/triggers.json"
OUTPUT_PNG     = f"{REAL_DATA_DIR}/triggers_overlay.png"

LABEL_OFFSET_PX = 8   # px offset so labels don't overlap the markers


def load_band(path):
    with rasterio.open(path) as src:
        return src.read(1).astype("float32"), src.transform


def compute_ndvi(red, nir):
    return (nir - red) / (nir + red + 1e-6)


def load_triggers():
    with open(TRIGGERS_FILE) as f:
        return json.load(f)


def main():
    after_red, transform = load_band(f"{REAL_DATA_DIR}/after_red.tif")
    after_nir, _ = load_band(f"{REAL_DATA_DIR}/after_nir.tif")
    ndvi_after = compute_ndvi(after_red, after_nir)

    triggers = load_triggers()

    fig, ax = plt.subplots(figsize=(10, 10))
    im = ax.imshow(ndvi_after, cmap="RdYlGn", vmin=-1, vmax=1)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="NDVI")

    for t in triggers:
        row, col = rasterio.transform.rowcol(transform, t["lon"], t["lat"])
        ax.plot(col, row, marker="x", color="red", markersize=10, markeredgewidth=2)
        ax.annotate(
            t["trigger_id"],
            (col, row),
            xytext=(LABEL_OFFSET_PX, LABEL_OFFSET_PX),
            textcoords="offset points",
            fontsize=6,
            color="red",
        )

    ax.set_title("After NDVI with detected triggers")
    ax.axis("off")

    fig.savefig(OUTPUT_PNG, dpi=150, bbox_inches="tight")
    print(f"Saved {OUTPUT_PNG}")


if __name__ == "__main__":
    main()
