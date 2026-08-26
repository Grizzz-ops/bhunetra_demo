"""
BhuNetra — visual sanity check for downloaded Sentinel-2/Sentinel-1/VIIRS
imagery.

Renders NDVI (optical), Lee-filtered VV backscatter in dB (SAR) with its
difference map, and VIIRS Black Marble nighttime-lights radiance (NTL) with
its difference map, for the before/after scenes in real_data/ so you can
eyeball whether the vegetation-loss, radar-change, and nighttime-activity
signals look real before trusting detection.py's output.
"""
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from matplotlib.gridspec import GridSpec
from scipy.ndimage import uniform_filter

REAL_DATA_DIR = "real_data"
OUTPUT_PNG = f"{REAL_DATA_DIR}/full_preview.png"

NDVI_BEFORE_LABEL = "NDVI Before (2020-01-01)"
NDVI_AFTER_LABEL  = "NDVI After (2024-01-05)"
SAR_BEFORE_LABEL  = "SAR VV Before (2020-01-02), Lee-filtered"
SAR_AFTER_LABEL   = "SAR VV After (2024-01-17), Lee-filtered"
DIFF_LABEL        = "SAR Change (After - Before, Lee-filtered)"
NTL_BEFORE_LABEL  = "VIIRS NTL Before (2020 annual composite)"
NTL_AFTER_LABEL   = "VIIRS NTL After (2024 annual composite)"
NTL_DIFF_LABEL    = "NTL Change (After - Before)"

LEE_WINDOW = 9
DIFF_VMIN, DIFF_VMAX = -8, 8


def load_band(path):
    with rasterio.open(path) as src:
        return src.read(1).astype("float32")


def load_band_masked(path):
    """Like load_band, but nodata pixels become NaN so they can't be
    silently treated as real (near-)zero backscatter."""
    with rasterio.open(path) as src:
        arr = src.read(1).astype("float32")
        if src.nodata is not None:
            arr[arr == src.nodata] = np.nan
        return arr


def compute_ndvi(red, nir):
    return (nir - red) / (nir + red + 1e-6)


def linear_to_db(x):
    # NaN (nodata) propagates through maximum/log10 rather than being
    # floored into a fake reading; np.errstate silences the resulting
    # (expected, harmless) invalid-value warning.
    with np.errstate(invalid="ignore"):
        return 10 * np.log10(np.maximum(x, 1e-5))


def nan_safe_windowed_mean(img, window_size):
    """scipy.ndimage.uniform_filter is a separable running-sum filter --
    a single NaN anywhere contaminates the ENTIRE output array, not just
    its local window (confirmed empirically). Work around it by filtering
    a zero-filled copy and a validity mask separately, then dividing --
    the standard NaN-safe box-filter trick."""
    valid = ~np.isnan(img)
    filled = np.where(valid, img, 0.0)
    area = window_size**2
    sum_ = uniform_filter(filled, window_size, mode="constant", cval=0.0) * area
    count = uniform_filter(valid.astype(img.dtype), window_size, mode="constant", cval=0.0) * area
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = sum_ / count
    mean[count == 0] = np.nan
    return mean


def lee_filter(img, window_size=5):
    img_mean = nan_safe_windowed_mean(img, window_size)
    img_sqr_mean = nan_safe_windowed_mean(img**2, window_size)
    img_variance = img_sqr_mean - img_mean**2
    # np.var() would return a single NaN if ANY pixel in img is NaN
    # (nodata), which then poisons every output pixel via the division
    # below -- nanvar() instead ignores NaNs when computing this global
    # scalar; per-pixel NaN propagation near nodata is still expected.
    overall_variance = np.nanvar(img)
    img_weights = img_variance / (img_variance + overall_variance)
    return img_mean + img_weights * (img - img_mean)


def main():
    before_red = load_band(f"{REAL_DATA_DIR}/before_red.tif")
    before_nir = load_band(f"{REAL_DATA_DIR}/before_nir.tif")
    after_red  = load_band(f"{REAL_DATA_DIR}/after_red.tif")
    after_nir  = load_band(f"{REAL_DATA_DIR}/after_nir.tif")

    ndvi_before = compute_ndvi(before_red, before_nir)
    ndvi_after  = compute_ndvi(after_red, after_nir)

    before_vv_db = linear_to_db(load_band_masked(f"{REAL_DATA_DIR}/before_vv.tif"))
    after_vv_db  = linear_to_db(load_band_masked(f"{REAL_DATA_DIR}/after_vv.tif"))

    # uniform_filter isn't NaN-aware, so nodata poisons a window-sized halo
    # around it too -- expected: better a visible gap than fabricated values.
    before_vv_db_filt = lee_filter(before_vv_db, LEE_WINDOW)
    after_vv_db_filt  = lee_filter(after_vv_db, LEE_WINDOW)
    diff_db = after_vv_db_filt - before_vv_db_filt

    n_valid = np.sum(~np.isnan(diff_db))
    print(f"SAR difference map (after - before, Lee-filtered, nodata excluded): "
          f"min={np.nanmin(diff_db):.2f} dB, max={np.nanmax(diff_db):.2f} dB, "
          f"mean={np.nanmean(diff_db):.2f} dB (n={n_valid}/{diff_db.size} valid px)")

    ntl_before = load_band_masked(f"{REAL_DATA_DIR}/before_ntl.tif")
    ntl_after  = load_band_masked(f"{REAL_DATA_DIR}/after_ntl.tif")
    ntl_diff   = ntl_after - ntl_before
    ntl_diff_abs_max = float(np.nanmax(np.abs(ntl_diff)))
    print(f"NTL difference map (after - before): "
          f"min={np.nanmin(ntl_diff):.2f}, max={np.nanmax(ntl_diff):.2f} "
          f"(radiance, nW/cm2/sr)")

    fig = plt.figure(figsize=(14, 28))
    gs = GridSpec(5, 2, figure=fig)

    ax_ndvi_before = fig.add_subplot(gs[0, 0])
    ax_ndvi_after  = fig.add_subplot(gs[0, 1])
    ax_sar_before  = fig.add_subplot(gs[1, 0])
    ax_sar_after   = fig.add_subplot(gs[1, 1])
    ax_diff        = fig.add_subplot(gs[2, :])
    ax_ntl_before  = fig.add_subplot(gs[3, 0])
    ax_ntl_after   = fig.add_subplot(gs[3, 1])
    ax_ntl_diff    = fig.add_subplot(gs[4, :])

    im_ndvi_before = ax_ndvi_before.imshow(ndvi_before, cmap="RdYlGn", vmin=-1, vmax=1)
    ax_ndvi_before.set_title(NDVI_BEFORE_LABEL)
    ax_ndvi_before.axis("off")

    im_ndvi_after = ax_ndvi_after.imshow(ndvi_after, cmap="RdYlGn", vmin=-1, vmax=1)
    ax_ndvi_after.set_title(NDVI_AFTER_LABEL)
    ax_ndvi_after.axis("off")

    fig.colorbar(im_ndvi_after, ax=[ax_ndvi_before, ax_ndvi_after],
                 fraction=0.023, pad=0.02, label="NDVI")

    sar_vmin = min(np.nanmin(before_vv_db_filt), np.nanmin(after_vv_db_filt))
    sar_vmax = max(np.nanmax(before_vv_db_filt), np.nanmax(after_vv_db_filt))

    im_sar_before = ax_sar_before.imshow(before_vv_db_filt, cmap="gray", vmin=sar_vmin, vmax=sar_vmax)
    ax_sar_before.set_title(SAR_BEFORE_LABEL)
    ax_sar_before.axis("off")

    im_sar_after = ax_sar_after.imshow(after_vv_db_filt, cmap="gray", vmin=sar_vmin, vmax=sar_vmax)
    ax_sar_after.set_title(SAR_AFTER_LABEL)
    ax_sar_after.axis("off")

    fig.colorbar(im_sar_after, ax=[ax_sar_before, ax_sar_after],
                 fraction=0.023, pad=0.02, label="VV (dB)")

    im_diff = ax_diff.imshow(diff_db, cmap="RdBu_r", vmin=DIFF_VMIN, vmax=DIFF_VMAX)
    ax_diff.set_title(DIFF_LABEL)
    ax_diff.axis("off")
    fig.colorbar(im_diff, ax=ax_diff, fraction=0.023, pad=0.02, label="ΔdB")

    ntl_vmin = min(np.nanmin(ntl_before), np.nanmin(ntl_after))
    ntl_vmax = max(np.nanmax(ntl_before), np.nanmax(ntl_after))

    im_ntl_before = ax_ntl_before.imshow(ntl_before, cmap="inferno", vmin=ntl_vmin, vmax=ntl_vmax)
    ax_ntl_before.set_title(NTL_BEFORE_LABEL)
    ax_ntl_before.axis("off")

    im_ntl_after = ax_ntl_after.imshow(ntl_after, cmap="inferno", vmin=ntl_vmin, vmax=ntl_vmax)
    ax_ntl_after.set_title(NTL_AFTER_LABEL)
    ax_ntl_after.axis("off")

    fig.colorbar(im_ntl_after, ax=[ax_ntl_before, ax_ntl_after],
                 fraction=0.023, pad=0.02, label="Radiance (nW/cm2/sr)")

    im_ntl_diff = ax_ntl_diff.imshow(ntl_diff, cmap="RdBu_r", vmin=-ntl_diff_abs_max, vmax=ntl_diff_abs_max)
    ax_ntl_diff.set_title(NTL_DIFF_LABEL)
    ax_ntl_diff.axis("off")
    fig.colorbar(im_ntl_diff, ax=ax_ntl_diff, fraction=0.023, pad=0.02, label="Δ Radiance")

    fig.savefig(OUTPUT_PNG, dpi=150, bbox_inches="tight")
    print(f"Saved {OUTPUT_PNG}")


if __name__ == "__main__":
    main()
