import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

load_dotenv()
raw_url = os.getenv("DATABASE_URL")
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(raw_url)
Session = sessionmaker(bind=engine)
db = Session()
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

from main import Officer, Base
Base.metadata.create_all(bind=engine)

officers_data = [
    {
        "name": "Rajesh Kumar",
        "email": "field@bhunetra.demo",
        "password_hash": pwd.hash("field123"),
        "role": "FIELD_OFFICER",
        "district": "Singrauli",
        "state": "Madhya Pradesh"
    },
    {
        "name": "Priya Sharma",
        "email": "dgm@bhunetra.demo",
        "password_hash": pwd.hash("dgm123"),
        "role": "DGM_ADMIN",
        "district": None,
        "state": "Madhya Pradesh"
    },
    {
        "name": "Anil Mishra",
        "email": "ibm@bhunetra.demo",
        "password_hash": pwd.hash("ibm123"),
        "role": "DGM_ADMIN",
        "district": None,
        "state": None
    }
]

for o in officers_data:
    exists = db.query(Officer).filter(
        Officer.email == o["email"]
    ).first()
    if not exists:
        db.add(Officer(**o))

db.commit()
print("✅ Officers created successfully")
print("-----------------------------------")
print("Field Officer → field@bhunetra.demo / field123")
print("DGM Admin     → dgm@bhunetra.demo   / dgm123")
print("IBM HQ        → ibm@bhunetra.demo   / ibm123")
db.close()