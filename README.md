# BhuNetra — Detection Engine (Member 1)

## What's in here
- `make_sample_data.py` — generates synthetic before/after imagery + a lease
  boundary, so you can test the pipeline today, before real Sentinel-2 data
  is downloaded.
- `detection.py` — the real detection engine: NDVI change detection,
  blob clustering, lease-boundary check, trigger JSON output.
- `validate.py` — computes Precision / Recall / F1 against a manually
  labeled ground-truth CSV (this is what answers the judges' "needs
  technical validation" feedback).
- `output/triggers.json` — pipeline output, ready to hand to Member 2
  (Verification/Scoring).

## Quickstart
```bash
pip install -r requirements.txt
python3 make_sample_data.py     # only needed once, or to regenerate test data
python3 detection.py            # runs detection, writes output/triggers.json
python3 validate.py             # prints Precision/Recall/F1
```

## Swapping in REAL Sentinel-2 data
1. Download Sentinel-2 L2A imagery for your demo site, two dates (before/after).
2. Extract Band 4 (Red) and Band 8 (NIR) as GeoTIFFs for each date.
3. Replace the 4 file paths at the top of `detection.py`:
   ```python
   BEFORE_RED = "your_real_data/before_B04.tif"
   BEFORE_NIR = "your_real_data/before_B08.tif"
   AFTER_RED  = "your_real_data/after_B04.tif"
   AFTER_NIR  = "your_real_data/after_B08.tif"
   ```
4. Replace `sample_data/lease_boundaries.geojson` with your real lease
   boundary polygon (from IBM/state DMG data, or manually digitized from
   Bhuvan/Google Earth for the demo — see the earlier chat for that path).
5. Run `detection.py` again — no other code changes needed.

## Re-validating on real data
Once you run detection on real imagery:
1. Open `output/triggers.json` and look at each detected trigger's
   coordinates on the before/after imagery yourself.
2. For each `trigger_id`, decide by eye: is this really new disturbance,
   or is it noise (farming, cloud shadow, seasonal vegetation change)?
3. Write those judgments into a new CSV (copy `ground_truth_demo.csv`'s
   format) — `TRUE` for real disturbance, `FALSE` for false positives.
4. If you can see real disturbance in the imagery that your pipeline
   *didn't* flag, add its coordinates as a `TRUE` row too, with a
   `trigger_id` that doesn't match anything detected — `validate.py`
   counts these as false negatives automatically.
5. Point `GROUND_TRUTH_FILE` in `validate.py` at your new CSV and rerun.

Expect real-imagery numbers to be lower and messier than this synthetic
100% — that's normal and expected. A real, honest number like "78%
precision on manually verified ground truth" is a far stronger claim
for judges than an unvalidated system, even though it's not 100%.

## Contract with Member 2 (Verification/Scoring)
Each trigger in `output/triggers.json` looks like:
```json
{
  "trigger_id": "MSS-897708",
  "site_id": "AOI-07-BALAGHAT",
  "lat": 21.84675,
  "lon": 80.15425,
  "change_pct": 83.9,
  "area_px": 25,
  "boundary_status": "boundary_violation",
  "detected_at": "2026-08-21T...",
  "source": "Sentinel-2 NDVI change detection",
  "status": "PENDING_SCORING"
}
```
Member 2's scoring script should read this JSON, add `ntl_delta` (VIIRS
nighttime-light signal) and `road_access_score` (OSM proximity signal),
compute a fused `confidence_score`, and flip `status` to `"PENDING_REVIEW"`
before handing off to Pair B's `POST /trigger` endpoint.
