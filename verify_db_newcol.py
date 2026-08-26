import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect

# Load variables from the .env file into the system environment, same as main.py
load_dotenv()

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
        "trigger_id", "site_id", "change_pct", "confidence_score", "confidence_tier",
        "boundary_status", "sar_change_score", "sar_mean_abs_change_db",
        "disturbance_area_m2", "ntl_delta", "legality_flag", "legality_assessment"
    ]

    missing = [f for f in required if f not in columns]

    if not missing:
        print("\nVERIFIED: All 12 widened fields exist in PostgreSQL!")
    else:
        print(f"\nMISSING FIELDS: {missing}")

except Exception as e:
    print(f"\nConnection Failed: {e}")