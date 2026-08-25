import os
from sqlalchemy import create_engine, inspect

# Put your connection string here if DATABASE_URL isn't set in CMD
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/dbname")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('alerts')]

    print("\n--- Columns Found in 'alerts' Table ---")
    for col in columns:
        print(f"  [+] {col}")

    required = [
        "trigger_id", "site_id", "confidence_score", "confidence_tier", 
        "boundary_status", "sar_change_score", "disturbance_area_m2", 
        "ntl_delta", "legality_flag", "legality_assessment"
    ]

    missing = [f for f in required if f not in columns]

    if not missing:
        print("\n✅ VERIFIED: All 10 widened fields exist in PostgreSQL!")
    else:
        print(f"\n❌ MISSING FIELDS: {missing}")

except Exception as e:
    print(f"\n❌ Connection Failed: {e}")