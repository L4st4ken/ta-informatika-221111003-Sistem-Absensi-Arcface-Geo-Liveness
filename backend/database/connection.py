# database/connection.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import Config

# -----------------------------
# SQLAlchemy Engine
# -----------------------------
engine = create_engine(
    Config.SQLALCHEMY_DATABASE_URI,
    echo=False,
    pool_pre_ping=True
)

# -----------------------------
# Session factory
# -----------------------------
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
print(Config.SQLALCHEMY_DATABASE_URI)

# -----------------------------
# Base model
# -----------------------------
Base = declarative_base()

# -----------------------------
# Dependency untuk routes
# -----------------------------
def get_db():
    """
    Dependency generator untuk FastAPI / Flask route.
    Gunakan: `db = next(get_db())`
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
