import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load your Railway URL from the .env file
load_dotenv()
raw_url = os.getenv("DATABASE_URL")

# Fix the Railway prefix trap
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)

# Connect to the cloud database
engine = create_engine(raw_url)

# Forcefully activate PostGIS
try:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.commit()
        print("✅ SUCCESS: PostGIS extension is now active!")
except Exception as e:
    print(f"❌ ERROR: {e}")