"""
BhuNetra -- batch-pregenerate officer briefs for every alert (B4).

Calls the exact same prompt-building and Gemini-call logic as
POST /api/v1/alerts/{id}/brief (imported directly from main.py, not
duplicated), but writes straight to the DB instead of going through HTTP.
Running this ahead of time means the demo never depends on a live model
call: an officer opening any alert always sees an already-cached
brief_text, even if Gemini is slow, rate-limited, or unreachable at
showtime.

*** RUN THIS AGAIN RIGHT BEFORE THE WED 21:00 FREEZE ***, and any time
after ingesting new triggers -- a newly ingested alert has no cached
brief and would otherwise fall back to a live call on demo day.

Usage:
    python db/generate_briefs.py            # only fills in missing/stale briefs
    python db/generate_briefs.py --force    # regenerates every alert's brief

Paced with a delay between calls and one retry-after-backoff on HTTP 429 --
confirmed live on 2026-08-26 that back-to-back calls to this free-tier key
can hit a rate limit mid-batch (alert 31 failed with 429 on an unpaced
run). A hard failure here still doesn't crash the batch either way: it's
logged and counted, and the summary tells you to re-run.
"""
import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

# This script lives in db/, but the helpers below are defined in main.py at
# the repo root -- add the repo root to sys.path so the import resolves.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from main import (  # noqa: E402 (must follow the sys.path fix above)
    Alert,
    BriefGenerationError,
    SessionLocal,
    build_brief_prompt,
    call_gemini,
    is_brief_stale,
)

DELAY_BETWEEN_CALLS_S = 4
RATE_LIMIT_BACKOFF_S = 30


def generate_with_retry(prompt: str) -> str:
    """One retry after a longer backoff, but only for a rate-limit (429)
    failure -- a bad key or malformed response won't fix itself by
    waiting, so those still fail immediately."""
    try:
        return call_gemini(prompt)
    except BriefGenerationError as e:
        if "HTTP 429" not in str(e):
            raise
        print(f"    rate-limited, waiting {RATE_LIMIT_BACKOFF_S}s and retrying once...")
        time.sleep(RATE_LIMIT_BACKOFF_S)
        return call_gemini(prompt)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true",
                         help="Regenerate even for alerts with a cached, non-stale brief_text")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        alerts = db.query(Alert).all()
        generated, skipped, failed = 0, 0, 0

        for alert in alerts:
            if not args.force and not is_brief_stale(alert):
                skipped += 1
                continue

            prompt = build_brief_prompt(alert)
            try:
                brief_text = generate_with_retry(prompt)
            except BriefGenerationError as e:
                print(f"  alert {alert.id}: FAILED -- {e}")
                failed += 1
                continue
            finally:
                time.sleep(DELAY_BETWEEN_CALLS_S)  # be polite to the free-tier rate limit

            alert.brief_text = brief_text
            alert.brief_generated_at = datetime.utcnow()
            db.commit()
            print(f"  alert {alert.id}: generated ({len(brief_text)} chars)")
            generated += 1

        print(f"\nDone. generated={generated} skipped_cached={skipped} failed={failed} total={len(alerts)}")
        if failed:
            print("Some briefs failed to generate -- re-run this script before the freeze "
                  "so the demo doesn't hit a missing brief live.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
