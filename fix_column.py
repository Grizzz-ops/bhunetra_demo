import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
raw_url = os.getenv("DATABASE_URL")
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(raw_url)

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS legal_status VARCHAR DEFAULT 'UNCHECKED';"))
    conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS legal_reason VARCHAR;"))
    conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS legal_weight FLOAT DEFAULT 0.0;"))
    conn.commit()
    print("✅ Columns added to Railway successfully")