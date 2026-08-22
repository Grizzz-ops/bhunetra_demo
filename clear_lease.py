import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
raw_url = os.getenv("DATABASE_URL")
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(raw_url)

with engine.connect() as conn:
    
    # Check how many leases exist right now
    result = conn.execute(text("SELECT COUNT(*) FROM leases;"))
    count = result.fetchone()[0]
    print(f"Current leases in database: {count}")
    
    # Delete all of them
    conn.execute(text("DELETE FROM leases;"))
    conn.commit()
    
    # Confirm they're gone
    result = conn.execute(text("SELECT COUNT(*) FROM leases;"))
    count = result.fetchone()[0]
    print(f"Leases after clearing: {count}")
    print("✅ Leases table cleared successfully")