"""
BhuNetra — real SAR-only change detection using monsoon data.

The monsoon_comparison.py figure showed SAR has usable data when optical
doesn't -- this script goes further and actually checks whether that
monsoon SAR data can still detect the mine: samples the SAR change map at
our 9 already-validated trigger locations (2020-01-02 dry-season baseline
vs 2024-07-03 monsoon scene) using the EXACT same windowed dB-change
method score_triggers.py uses for the dry-season pair, so the two numbers
are genuinely comparable, not apples-to-oranges.

Does not touch the January 2020/2024 optical pipeline or its outputs --
separate diagnostic script, separate output file.
"""
import json

import matplotlib.pyplot as plt
import numpy as np
import rasterio

import check_imagery as ci
import score_triggers as st

REAL_DATA_DIR = "real_data"
BEFORE_VV_FILE   = f"{REAL_DATA_DIR}/before_vv.tif"        # 2020-01-02, dry season
MONSOON_VV_FILE  = f"{REAL_DATA_DIR}/monsoon_test_vv.tif"  # 2024-07-03, monsoon
TRIGGERS_FILE    = "output/triggers.json"
SCORED_FILE      = "output/triggers_scored.json"  # for the dry-season sar_mean_abs_change_db comparison
OUTPUT_PNG       = f"{REAL_DATA_DIR}/monsoon_detection.png"

BEFORE_LABEL  = "SAR Before (2020-01-02, dry season), Lee-filtered"
MONSOON_LABEL = "SAR After (2024-07-03, MONSOON), Lee-filtered"
DIFF_LABEL    = "SAR Change (monsoon - before) with 9 known trigger locations"
SUPTITLE      = "Mining detection using monsoon SAR data (optical unusable this date)"

LEE_WINDOW = 9


def main():
    # Visualization panels: Lee-filtered dB, same style as full_preview.png
    before_db = ci.linear_to_db(ci.load_band_masked(BEFORE_VV_FILE))
    monsoon_db = ci.linear_to_db(ci.load_band_masked(MONSOON_VV_FILE))
    before_db_filt = ci.lee_filter(before_db, LEE_WINDOW)
    monsoon_db_filt = ci.lee_filter(monsoon_db, LEE_WINDOW)
    diff_db = monsoon_db_filt - before_db_filt

    diff_abs_max = float(np.nanmax(np.abs(diff_db)))
    print(f"SAR change map (monsoon - before, Lee-filtered): "
          f"min={np.nanmin(diff_db):.2f} dB, max={np.nanmax(diff_db):.2f} dB, "
          f"mean={np.nanmean(diff_db):.2f} dB")

    # Per-trigger sampling: EXACT same method as score_triggers.py's
    # sar_change_score() -- raw (non-Lee-filtered) +/-5px window, mean
    # absolute dB change -- so this is directly comparable to the existing
    # dry-season sar_mean_abs_change_db values, not a different metric.
    before_vv, before_transform = st.load_vv_band(BEFORE_VV_FILE)
    monsoon_vv, monsoon_transform = st.load_vv_band(MONSOON_VV_FILE)

    triggers = json.load(open(TRIGGERS_FILE))
    dry_season_lookup = {t["trigger_id"]: t.get("sar_mean_abs_change_db")
                          for t in json.load(open(SCORED_FILE))}

    print("\nPer-trigger monsoon SAR change (+/-5px window, mean |dB| change), "
          "vs. existing dry-season value:")
    print("-" * 90)
    results = []
    for t in triggers:
        _, monsoon_mean_abs_db = st.sar_change_score(
            t["lat"], t["lon"], before_vv, before_transform, monsoon_vv, monsoon_transform
        )
        dry_val = dry_season_lookup.get(t["trigger_id"])
        results.append((t["trigger_id"], monsoon_mean_abs_db, dry_val))
        monsoon_str = f"{monsoon_mean_abs_db:.2f} dB" if monsoon_mean_abs_db is not None else "UNAVAILABLE"
        dry_str = f"{dry_val:.2f} dB" if dry_val is not None else "n/a"
        print(f"  {t['trigger_id']}  |  monsoon={monsoon_str:>12s}  |  dry-season={dry_str:>10s}")

    # Figure
    fig, (ax_before, ax_after, ax_diff) = plt.subplots(1, 3, figsize=(20, 7))

    sar_vmin = min(np.nanmin(before_db_filt), np.nanmin(monsoon_db_filt))
    sar_vmax = max(np.nanmax(before_db_filt), np.nanmax(monsoon_db_filt))

    im0 = ax_before.imshow(before_db_filt, cmap="gray", vmin=sar_vmin, vmax=sar_vmax)
    ax_before.set_title(BEFORE_LABEL, fontsize=10)
    ax_before.axis("off")
    fig.colorbar(im0, ax=ax_before, fraction=0.046, pad=0.04, label="VV (dB)")

    im1 = ax_after.imshow(monsoon_db_filt, cmap="gray", vmin=sar_vmin, vmax=sar_vmax)
    ax_after.set_title(MONSOON_LABEL, fontsize=10)
    ax_after.axis("off")
    fig.colorbar(im1, ax=ax_after, fraction=0.046, pad=0.04, label="VV (dB)")

    im2 = ax_diff.imshow(diff_db, cmap="RdBu_r", vmin=-diff_abs_max, vmax=diff_abs_max)
    ax_diff.set_title(DIFF_LABEL, fontsize=10)
    ax_diff.axis("off")
    fig.colorbar(im2, ax=ax_diff, fraction=0.046, pad=0.04, label="ΔdB")

    with rasterio.open(BEFORE_VV_FILE) as src:
        transform = src.transform
    for trigger_id, monsoon_val, dry_val in results:
        t = next(x for x in triggers if x["trigger_id"] == trigger_id)
        row, col = rasterio.transform.rowcol(transform, t["lon"], t["lat"])
        ax_diff.plot(col, row, marker="x", color="lime", markersize=10, markeredgewidth=2)
        ax_diff.annotate(trigger_id.replace("MSS-", ""), (col, row),
                          xytext=(5, 5), textcoords="offset points",
                          fontsize=6, color="lime", weight="bold")

    fig.suptitle(SUPTITLE, fontsize=15, weight="bold")
    fig.savefig(OUTPUT_PNG, dpi=150, bbox_inches="tight")
    print(f"\nSaved {OUTPUT_PNG}")


if __name__ == "__main__":
    main()
