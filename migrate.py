import os
from sqlalchemy import create_engine, text

# Retrieve your database connection string
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is missing!")

# Fix for Railway/Heroku postgres:// vs postgresql:// compatibility
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

# SQL script to safely add missing columns without dropping existing data
MIGRATION_SQL = """
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS trigger_id VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS site_id INTEGER;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS confidence_tier VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS boundary_status VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS sar_change_score FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS disturbance_area_m2 FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS ntl_delta FLOAT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS legality_flag VARCHAR;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS legality_assessment JSONB;
"""

def run_migration():
    print("Connecting to PostgreSQL and running migration...")
    with engine.connect() as conn:
        conn.execute(text(MIGRATION_SQL))
        conn.commit()
    print("✅ Migration successful! All 10 new columns added to 'alerts' table.")

if __name__ == "__main__":
    run_migration()