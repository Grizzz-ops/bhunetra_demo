"""
BhuNetra -- one-time production data cleanup.

Two problems in the live DB, both from an earlier ingestion format:

  1. ~10 orphan Alert rows with trigger_id IS NULL (also missing site_id,
     legality_flag, created_at). They are stale duplicates of the properly
     ingested MSS alerts and were only ever hidden by a frontend filter.
     ~26 audit_logs rows point at them.

  2. Every real alert has site_id = 'AOI-07-BALAGHAT'. The AOI is Bailadila
     (Dantewada) -- "Balaghat" is a copy-paste error from the pipeline. The
     frontend was string-replacing BALAGHAT -> BAILADILA in several places
     to paper over it.

This script deletes the orphans (and their audit rows) and fixes the
site_id. Idempotent: re-running it is a no-op once clean.

Run once, manually, with DATABASE_URL set (same as db/migrate.py):
    python db/cleanup_data.py
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is missing!")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)


def run_cleanup():
    with engine.begin() as conn:  # begin() = transaction, auto-commit/rollback
        orphan_ids = [
            r[0] for r in conn.execute(
                text("SELECT id FROM alerts WHERE trigger_id IS NULL")
            )
        ]
        print(f"Orphan alerts (trigger_id IS NULL): {len(orphan_ids)} -> {orphan_ids}")

        if orphan_ids:
            deleted_audit = conn.execute(
                text("DELETE FROM audit_logs WHERE alert_id = ANY(:ids)"),
                {"ids": orphan_ids},
            ).rowcount
            deleted_alerts = conn.execute(
                text("DELETE FROM alerts WHERE id = ANY(:ids)"),
                {"ids": orphan_ids},
            ).rowcount
            print(f"  deleted {deleted_audit} audit_logs rows")
            print(f"  deleted {deleted_alerts} alerts rows")

        fixed = conn.execute(
            text(
                "UPDATE alerts SET site_id = 'AOI-07-BAILADILA' "
                "WHERE site_id = 'AOI-07-BALAGHAT'"
            )
        ).rowcount
        print(f"site_id AOI-07-BALAGHAT -> AOI-07-BAILADILA: {fixed} rows")

    print("Cleanup complete.")


if __name__ == "__main__":
    run_cleanup()
