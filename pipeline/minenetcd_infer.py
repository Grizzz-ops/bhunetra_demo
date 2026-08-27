"""
BhuNetra -- real inference wrapper around ericyu/minenetcd-upernet-Swin-Diff-B-Pretrained.

Requires the ML-only virtualenv (torch/transformers/timm on top of the main
project's requirements -- see requirements-ml.txt). The main FastAPI app and
the rest of pipeline/ do NOT need these, so this stays a separate, opt-in
stage rather than something bundled into the default deploy:

    <ml-venv>/Scripts/python.exe pipeline/detection_minenetcd.py

CAVEATS -- read before trusting the output as a production signal:

  1. RESOLUTION MISMATCH, HANDLED VIA SCALE-MATCHED TILING. MineNetCD256's
     imagery is Google Earth-sourced at ~1.2m/px (confirmed via the paper's
     data-acquisition description -- see TRAIN_GSD_M below). Our real
     imagery (real_data/*.tif) is raw Sentinel-2 at ~10.35m/px -- an ~8.6x
     GSD gap. Feeding the model raw 256x256 pixel windows of our data means
     each window covers ~8.6x more ground than a training patch; measured
     empirically, the model then collapses to a confident "no change"
     everywhere (class-1 probability capped around 5%) even on windows
     with obvious real pixel-level change. Cropping a native window sized
     to match the training patch's real-world footprint (TILE * TRAIN_GSD_M
     meters) and upsampling it to 256x256 restores the model's ability to
     detect change (verified: class-1 probability reached 99.8% on a real
     changed area once footprint-matched). This is what detect_change_mask
     does below. It does NOT recover true 1.2m detail -- it's still
     upsampled/blurry 10m data -- so treat detections as a genuine but
     coarse signal, not equivalent in precision to the benchmark's own
     numbers (MINENETCD_EVAL_RESULTS below, which is for native-resolution
     imagery).
  2. NO GREEN BAND, AND THE MODEL IS SENSITIVE TO HOW IT'S APPROXIMATED.
     The model expects natural RGB; real_data/ has red/nir/blue/swir/vv
     but no green. We approximate G = (Red + NIR) / 2. Measured, not
     assumed: on the identical scene, G=(Red+NIR)/2 flags 11.1% of pixels
     changed, G=Red flags 23.0%, G=NIR flags only 0.9% -- a >25x swing from
     this one preprocessing choice alone, bigger than either the tiling or
     resolution effects. There is no principled way to pick a Green
     approximation without a real Green band or ground truth to calibrate
     against -- (Red+NIR)/2 is kept as the default only because it's the
     least extreme (a genuine average, not a duplicate of an existing
     band). Treat this as a real, unresolved limitation.

MINENETCD_EVAL_RESULTS (full HZDR-FWGEL/MineNetCD256 test split, 19,355
images, ericyu/minenetcd-upernet-Swin-Diff-B-Pretrained, official test.py
logic): OA=0.9227 Precision=0.7249 Recall=0.6238 F1=0.6706 cIoU=0.5044.
"""
import math
import os

import cv2
import numpy as np
import torch
import torchvision.transforms as tfs

from minenetcd_model import UperNetForSemanticSegmentation

# Override via MINENETCD_MODEL_ID env var to try a different checkpoint
# (e.g. the ChangeFFT variant, "ericyu/minenetcd-upernet-Swin-Diff-B-
# Pretrained-ChannelMixing-Dropout" -- see README for the benchmark
# comparison between the two).
MODEL_ID = os.environ.get("MINENETCD_MODEL_ID", "ericyu/minenetcd-upernet-Swin-Diff-B-Pretrained")
TILE = 256
# MineNetCD256 imagery is Google Earth-sourced high-resolution imagery at
# ~1.2m/px (per the paper's data-acquisition description, confirmed via
# web search -- not stated in the HF dataset card itself). Used to compute
# how many *native* pixels of our own imagery correspond to one training
# patch's real-world footprint, so we can scale-match before inference
# instead of feeding the model 8x-too-zoomed-out windows.
TRAIN_GSD_M = 1.2
ADE_MEAN = np.array([123.675, 116.280, 103.530]) / 255
ADE_STD = np.array([58.395, 57.120, 57.375]) / 255

_model = None
_device = None


def _get_device():
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_model():
    """Lazy singleton -- loads once per process."""
    global _model, _device
    if _model is None:
        _device = _get_device()
        _model = UperNetForSemanticSegmentation.from_pretrained(MODEL_ID, ignore_mismatched_sizes=True)
        _model = _model.to(_device)
        _model.eval()
    return _model, _device


def percentile_stretch_uint8(band, p_lo=2, p_hi=98):
    """Standard remote-sensing visualization stretch: raw DN/reflectance ->
    0-255 uint8 using the 2nd/98th percentile as black/white points, so a
    few saturated outlier pixels don't wash out the whole image."""
    band = band.astype("float32")
    lo, hi = np.percentile(band, [p_lo, p_hi])
    if hi <= lo:
        return np.zeros(band.shape, dtype="uint8")
    stretched = np.clip((band - lo) / (hi - lo), 0, 1)
    return (stretched * 255).astype("uint8")


def build_rgb_composite(red, nir, blue):
    """R=Red, G=(Red+NIR)/2 [no real Green band available -- see module
    docstring caveat 2], B=Blue. Returns HxWx3 uint8."""
    r = percentile_stretch_uint8(red)
    n = percentile_stretch_uint8(nir)
    b = percentile_stretch_uint8(blue)
    g = ((r.astype("uint16") + n.astype("uint16")) // 2).astype("uint8")
    return np.stack([r, g, b], axis=-1)


def _to_model_tensor(tile_uint8, device):
    tensor = tfs.ToTensor()(tile_uint8)  # HWC uint8 -> CHW float [0,1]
    tensor = tfs.Normalize(mean=ADE_MEAN, std=ADE_STD)(tensor)
    return tensor.unsqueeze(0).to(device)


def native_window_px(source_gsd_m):
    """How many pixels of OUR imagery cover the same real-world footprint
    as one 256x256 training patch (TILE * TRAIN_GSD_M meters). E.g. at
    Sentinel-2's ~10.35m/px: round(256 * 1.2 / 10.35) = 30px. Clamped to
    >=1 and <=TILE (if our data is already finer than training res, this
    would come out >TILE, i.e. no upsampling needed -- clamp so the tiler
    below degrades to plain same-scale tiling instead of downsampling,
    since we've never actually seen that case with our data)."""
    px = round(TILE * TRAIN_GSD_M / source_gsd_m)
    return max(1, min(TILE, px))


def _window_starts(size, win, stride):
    """Sliding-window start offsets covering >=size with full `win`-sized
    windows at `stride` spacing. Returns (starts, padded_size)."""
    if size <= win:
        return [0], win
    n = math.ceil((size - win) / stride) + 1
    padded_size = (n - 1) * stride + win
    return [i * stride for i in range(n)], padded_size


def detect_change_mask(before_rgb, after_rgb, source_gsd_m):
    """before_rgb, after_rgb: HxWx3 uint8 arrays, same shape (from
    build_rgb_composite). source_gsd_m: meters/pixel of that imagery (e.g.
    from pixel_size_meters() in detection_minenetcd.py).

    Scale-matched, OVERLAPPING tiling: crops native
    `native_window_px(source_gsd_m)`-sized windows (matching the training
    patch's real-world footprint) at 50% stride, upsamples each to 256x256
    (bicubic) before inference, downsamples the resulting change-class
    PROBABILITY map (not a hard label -- linear interpolation, since it's
    continuous) back to native size, and averages overlapping windows'
    probabilities per pixel before thresholding at the end.

    Why overlap-average instead of the simpler non-overlapping tiling this
    replaced: measured empirically, non-overlapping tiling was sensitive to
    the tiling grid's exact phase -- shifting the grid by half a window on
    the *same* scene changed which pixels got flagged with only ~0.41 IoU
    between the two runs. 50%-stride overlap-averaging is the standard fix
    for this in tiled semantic segmentation (every pixel gets predicted by
    2-4 windows at different offsets, and averaging smooths out any single
    window's boundary artifacts) -- it does not fix the underlying
    resolution-mismatch caveat (see module docstring caveat 1), only the
    separate tiling-grid-sensitivity issue.

    Returns an HxW uint8 binary change mask (1=change), cropped back to the
    input's original size.
    """
    model, device = load_model()

    win = native_window_px(source_gsd_m)
    stride = max(1, win // 2)

    h, w = before_rgb.shape[:2]
    y_starts, padded_h = _window_starts(h, win, stride)
    x_starts, padded_w = _window_starts(w, win, stride)

    pad_spec = ((0, padded_h - h), (0, padded_w - w), (0, 0))
    padded_before = np.pad(before_rgb, pad_spec, mode="reflect") if (padded_h > h or padded_w > w) else before_rgb
    padded_after = np.pad(after_rgb, pad_spec, mode="reflect") if (padded_h > h or padded_w > w) else after_rgb

    prob_sum = np.zeros((padded_h, padded_w), dtype="float32")
    count = np.zeros((padded_h, padded_w), dtype="float32")

    with torch.no_grad():
        for y in y_starts:
            for x in x_starts:
                win_before = padded_before[y:y + win, x:x + win]
                win_after = padded_after[y:y + win, x:x + win]

                if win == TILE:
                    tile_before, tile_after = win_before, win_after
                else:
                    tile_before = cv2.resize(win_before, (TILE, TILE), interpolation=cv2.INTER_CUBIC)
                    tile_after = cv2.resize(win_after, (TILE, TILE), interpolation=cv2.INTER_CUBIC)

                tensor_before = _to_model_tensor(tile_before, device)
                tensor_after = _to_model_tensor(tile_after, device)
                # Mirrors the official test.py/run_eval.py convention exactly:
                # pixel_values = torch.cat([imageA, imageB]) with imageA
                # first. We map before->imageA, after->imageB since that's
                # the natural reading and MineNetCD's dataset card doesn't
                # document which temporal order A/B actually is.
                pixel_values = torch.cat([tensor_before, tensor_after], dim=0)

                outputs = model(pixel_values=pixel_values)
                probs_256 = torch.softmax(outputs.logits, dim=1)[0, 1].cpu().numpy().astype("float32")

                if win == TILE:
                    probs_native = probs_256
                else:
                    probs_native = cv2.resize(probs_256, (win, win), interpolation=cv2.INTER_LINEAR)

                prob_sum[y:y + win, x:x + win] += probs_native
                count[y:y + win, x:x + win] += 1.0

    avg_prob = prob_sum / np.maximum(count, 1.0)
    mask = (avg_prob > 0.5).astype("uint8")
    return mask[:h, :w]
