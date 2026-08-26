"""
BhuNetra — lock down alerts.status to the three real workflow states.

Usage:
    python add_status_constraint.py            # just show the status distribution
    python add_status_constraint.py --fix       # apply STATUS_FIXES below, then show it again
    python add_status_constraint.py --constrain # add the CHECK constraint (idempotent)

Run in that order. Inspect the distribution first; if anything other than
PENDING_OFFICER / ESCALATED_DGM / RESOLVED shows up, add a targeted mapping
to STATUS_FIXES below (don't blind-catch-all it) and run with --fix before
--constrain, or the ALTER TABLE will fail against existing rows.
"""
import argparse
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

ALLOWED_STATUSES = ("PENDING_OFFICER", "ESCALATED_DGM", "RESOLVED")

# Filled in from the real distribution on Railway (checked 2026-08-26):
#   'PENDING' (5 rows) -- legacy/truncated label for what the model calls
#   PENDING_OFFICER. 'ESCALATED_DGM' (4) and 'PENDING_OFFICER' (1) were
#   already valid.
STATUS_FIXES = {"PENDING": "PENDING_OFFICER"}

# Postgres has no "ADD CONSTRAINT IF NOT EXISTS" — wrap it so re-running
# this script doesn't crash on a constraint that's already there.
ADD_CONSTRAINT_SQL = """
DO $$
BEGIN
    ALTER TABLE alerts
        ADD CONSTRAINT chk_alerts_status
        CHECK (status IN ('PENDING_OFFICER', 'ESCALATED_DGM', 'RESOLVED'));
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'chk_alerts_status already exists, skipping';
END $$;
"""


def show_distribution(conn):
    rows = conn.execute(text(
        "SELECT status, COUNT(*) FROM alerts GROUP BY status ORDER BY status;"
    )).fetchall()
    print("status distribution:")
    bad = []
    for status, count in rows:
        flag = "" if status in ALLOWED_STATUSES else "  <-- outside allowed set"
        print(f"  {status!r:20s} {count:5d}{flag}")
        if status not in ALLOWED_STATUSES:
            bad.append(status)
    return bad


def apply_fixes(conn, bad_values):
    unmapped = [v for v in bad_values if v not in STATUS_FIXES]
    if unmapped:
        raise SystemExit(
            f"No STATUS_FIXES entry for: {unmapped!r}. "
            "Add a targeted mapping for each before running --fix."
        )
    for bad_value, good_value in STATUS_FIXES.items():
        result = conn.execute(
            text("UPDATE alerts SET status = :good WHERE status = :bad"),
            {"good": good_value, "bad": bad_value},
        )
        print(f"  UPDATE: {bad_value!r} -> {good_value!r} ({result.rowcount} row(s))")
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true", help="Apply STATUS_FIXES to bad rows")
    parser.add_argument("--constrain", action="store_true", help="Add the CHECK constraint")
    args = parser.parse_args()

    with engine.connect() as conn:
        bad = show_distribution(conn)

        if args.fix:
            if not bad:
                print("\nNo values outside the allowed set — nothing to fix.")
            else:
                print()
                apply_fixes(conn, bad)
                print("\nRe-checking distribution:")
                bad = show_distribution(conn)

        if args.constrain:
            if bad:
                raise SystemExit(
                    f"\nRefusing to add the constraint: {bad!r} still outside the "
                    "allowed set. Run with --fix first (after filling in STATUS_FIXES)."
                )
            conn.execute(text(ADD_CONSTRAINT_SQL))
            conn.commit()
            print("\nchk_alerts_status is in place.")


if __name__ == "__main__":
    main()
