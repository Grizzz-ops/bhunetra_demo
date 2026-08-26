import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
load_dotenv()
raw_url = os.getenv("DATABASE_URL")
if raw_url.startswith("postgres://"): 
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)
engine = create_engine(raw_url)
with engine.connect() as conn:
    result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='alerts';"))
    for row in result:
        print(row[0])