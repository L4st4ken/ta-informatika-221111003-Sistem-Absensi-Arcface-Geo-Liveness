# config.py
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()  # baca .env jika ada

class Config:
    # ========================
    # Database (MySQL + SQLAlchemy)
    # ========================
    MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB = os.getenv("MYSQL_DB", "db_arcface_TA")

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ========================
    # Flask Behavior
    # ========================
    DEBUG = os.getenv("DEBUG_MODE", "true").lower() == "true"
    TESTING = os.getenv("TESTING", "false").lower() == "true"

    # ========================
    # JWT
    # ========================
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "SUPERRAHASIA123")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", 15)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 7)))
    # add secure cookie config if needed:
    JWT_COOKIE_SECURE = True   # set True in prod (HTTPS)
    JWT_TOKEN_LOCATION = ["headers", "cookies"]  # optional
    JWT_COOKIE_CSRF_PROTECT = True

    # ========================
    # Face & Liveness
    # ========================
    GEOTEST_RADIUS_METER = int(os.getenv("GEOTEST_RADIUS_METER", 50))
    ARCFACE_THRESHOLD = float(os.getenv("ARCFACE_THRESHOLD", 0.45))
    LIVENESS_BLINK_MIN = int(os.getenv("LIVENESS_BLINK_MIN", 3))
    LIVENESS_BLINK_MAX = int(os.getenv("LIVENESS_BLINK_MAX", 5))
    DLIB_LANDMARK_PATH = os.getenv("DLIB_LANDMARK_PATH", "models/shape_predictor_68_face_landmarks.dat")

    # ========================
    # Uploads / Images
    # ========================
    MAX_IMAGE_SIZE_MB = float(os.getenv("MAX_IMAGE_SIZE_MB", 3))
    ALLOWED_EXTENSIONS = set(os.getenv("ALLOWED_EXTENSIONS", "jpg,jpeg,png").split(","))


class DevConfig(Config):
    DEBUG = True


class ProdConfig(Config):
    DEBUG = False
