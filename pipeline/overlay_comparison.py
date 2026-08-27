"""
BhuNetra -- visual cross-validation: NDVI detector (detection.py) vs the
MineNetCD deep model (detection_minenetcd.py), run on the SAME before/after
pair, plotted on top of each other over the "after" NDVI map.

Red X = NDVI trigger, cyan + = MineNetCD trigger. Where they land near each
other is corroborating signal between two independent detection methods;
where they diverge is worth a manual look -- and NOT necessarily an error,
since "nearest trigger" pairing is proximity-based, not a claim that two
nearby markers are detecting the *same* underlying change.

Usage:
    python pipeline/overlay_comparison.py \\
        --data-dir real_data \\
        --ndvi-triggers output/triggers_scored.json \\
        --mnc-triggers output/triggers_minenetcd.json \\
        --title "2020-01 vs 2024-01"

    python pipeline/overlay_comparison.py \\
        --data-dir real_data_2026 \\
        --ndvi-triggers output/triggers_2026_ndvi.json \\
        --mnc-triggers output/triggers_2026_minenetcd.json \\
        --title "2020-01 vs 2026-06"
"""
import argparse
import json

import matplotlib.pyplot as plt
import rasterio


def load_band(path):
    with rasterio.open(path) as src:
        return src.read(1).astype("float32"), src.transform


def compute_ndvi(red, nir):
    return (nir - red) / (nir + red + 1e-6)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", required=True, help="folder with after_red.tif/after_nir.tif")
    p.add_argument("--ndvi-triggers", required=True)
    p.add_argument("--mnc-triggers", required=True)
    p.add_argument("--title", required=True, help="e.g. '2020-01 vs 2024-01'")
    p.add_argument("--output", default=None, help="defaults to <data-dir>/triggers_comparison.png")
    args = p.parse_args()

    output_png = args.output or f"{args.data_dir}/triggers_comparison.png"

    after_red, transform = load_band(f"{args.data_dir}/after_red.tif")
    after_nir, _ = load_band(f"{args.data_dir}/after_nir.tif")
    ndvi_after = compute_ndvi(after_red, after_nir)

    ndvi_triggers = json.load(open(args.ndvi_triggers))
    mnc_triggers = json.load(open(args.mnc_triggers))

    fig, ax = plt.subplots(figsize=(10, 10))
    im = ax.imshow(ndvi_after, cmap="RdYlGn", vmin=-1, vmax=1)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="NDVI")

    for t in ndvi_triggers:
        row, col = rasterio.transform.rowcol(transform, t["lon"], t["lat"])
        ax.plot(col, row, marker="x", color="red", markersize=12, markeredgewidth=2)

    for t in mnc_triggers:
        row, col = rasterio.transform.rowcol(transform, t["lon"], t["lat"])
        ax.plot(col, row, marker="+", color="cyan", markersize=14, markeredgewidth=2.5)

    ax.plot([], [], marker="x", color="red", markersize=10, markeredgewidth=2, linestyle="none",
            label=f"NDVI (detection.py) -- {len(ndvi_triggers)} triggers")
    ax.plot([], [], marker="+", color="cyan", markersize=10, markeredgewidth=2, linestyle="none",
            label=f"MineNetCD (detection_minenetcd.py) -- {len(mnc_triggers)} triggers")
    ax.legend(loc="upper right", fontsize=9, framealpha=0.9)

    ax.set_title(f"{args.title} real Sentinel-2 pair: NDVI vs MineNetCD detections")
    ax.axis("off")

    fig.savefig(output_png, dpi=150, bbox_inches="tight")
    print(f"Saved {output_png}")


if __name__ == "__main__":
    main()
