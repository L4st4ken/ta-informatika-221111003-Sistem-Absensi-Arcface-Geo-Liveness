# app.py
import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager, decode_token
from models.models import RefreshToken
import logging
from logging.handlers import RotatingFileHandler

from config import Config
from database.connection import Base, engine, SessionLocal

# Import blueprint
from routes.auth import auth_bp
from routes.attendance import attendance_bp
from routes.schedule import schedule_bp
from routes.admin import admin_bp
from routes.face import face_bp
from routes.dashboard import dashboard_bp

# ========================
# Flask app initialization
# ========================
app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS
CORS(app, supports_credentials=True)

# JWT setup
jwt = JWTManager(app)
@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """
    Dipanggil setiap kali ada token yang diverifikasi.
    Kita akan cek apakah token (access/refresh) JTI ada di DB dan revoked.
    """
    jti = jwt_payload.get("jti")
    token_type = jwt_payload.get("type")  # "access" or "refresh"
    # Only check refresh tokens in DB; for access tokens, we can optionally check blocklist too
    db = SessionLocal()
    try:
        # prefer to check refresh tokens table
        record = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
        if record:
            return record.revoked
        # if not found -> not revoked (but you can treat missing as revoked if you want stricter policy)
        return False
    finally:
        db.close()

# ========================
# Logging setup
# ========================
log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, "app.log")

handler = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=2)
formatter = logging.Formatter(
    "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)
handler.setFormatter(formatter)
handler.setLevel(logging.INFO)
app.logger.addHandler(handler)
app.logger.setLevel(logging.INFO)

app.logger.info("OK Logging initialized.")

# ========================
# Database setup
# ========================
Base.metadata.create_all(bind=engine)
app.logger.info("OK Database tables ensured (Base.metadata.create_all).")

# ========================
# Register blueprints
# ========================
blueprints = [
    (auth_bp, "/auth"),
    (attendance_bp, "/attendance"),
    (schedule_bp, "/schedule"),
    (admin_bp, "/admin"),
    (face_bp, "/face"),
    (dashboard_bp, "/dashboard")
]

for bp, prefix in blueprints:
    try:
        app.register_blueprint(bp, url_prefix=prefix)
        app.logger.info(f"Registered blueprint: {bp.name} -> {prefix}")
    except Exception as e:
        app.logger.warning(f"Could not register blueprint {bp}: {e}")

# ========================
# Default route
# ========================
@app.route("/")
def index():
    return {"message": "ArcFace TA Attendance Backend Running 🚀"}

# ========================
# Run app (development only)
# ========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
