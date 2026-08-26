import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load variables from the .env file into the system environment, same as main.py
load_dotenv()

# Retrieve your database connection string
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is missing!")

# Fix for Railway/Heroku postgres:// vs postgresql:// compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

# SQL script to safely add missing columns without dropping existing data.
#
# Types here must match main.py's Alert model exactly:
#   - site_id is Column(String) on the model, NOT Integer. The original
#     version of this script had it as INTEGER, which would silently make
#     ingest_trigger() fail (or truncate) the moment a non-numeric site_id
#     like "AOI-07-BALAGHAT" came through.
#   - change_pct and sar_mean_abs_change_db were missing entirely below —
#     the model has 12 new columns, this only added 10.
MIGRATION_SQL = """
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS trigger_id VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS site_id VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS change_pct FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS confidence_tier VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS boundary_status VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sar_change_score FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sar_mean_abs_change_db FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS disturbance_area_m2 FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS ntl_delta FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS legality_flag VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS legality_assessment JSONB;

-- The Alert model declares trigger_id as unique=True, index=True, and
-- ingest_trigger() relies on that uniqueness to turn a duplicate insert
-- into an IntegrityError it can catch and turn into HTTP 409. Adding the
-- column above does NOT add that constraint — without this index, two
-- POSTs with the same trigger_id would both succeed silently.
CREATE UNIQUE INDEX IF NOT EXISTS ix_alerts_trigger_id ON alerts (trigger_id);
"""

def run_migration():
    print("Connecting to PostgreSQL and running migration...")
    with engine.connect() as conn:
        conn.execute(text(MIGRATION_SQL))
        conn.commit()
    print("Migration successful! All 12 new columns + trigger_id unique index are on 'alerts'.")

if __name__ == "__main__":
    run_migration()