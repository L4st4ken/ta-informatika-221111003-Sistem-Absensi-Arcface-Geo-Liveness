import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import logging
from logging.handlers import RotatingFileHandler

from config import Config
from database.connection import Base, engine

# Import blueprint (HANYA YANG TERSISA DAN RELEVAN)
from routes.auth import auth_bp
from routes.attendance import attendance_bp
from routes.admin import admin_bp
from routes.dashboard import dashboard_bp
from routes.branches import branches_bp

# ========================
# Flask app initialization
# ========================
app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",  # Atau spesifikkan ke URL Next.js Anda
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "ngrok-skip-browser-warning"]
    }
})

# JWT setup (Stateless & Super Cepat)
jwt = JWTManager(app)

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
    (admin_bp, "/admin"),
    (dashboard_bp, "/dashboard"),
    (branches_bp, "/branches") # Registrasi Rute Cabang
]

for bp, prefix in blueprints:
    try:
        app.register_blueprint(bp, url_prefix=prefix)
        app.logger.info(f"Registered blueprint: {bp.name} -> {prefix}")
    except Exception as e:
        app.logger.warning(f"Could not register blueprint {bp.name}: {e}")

# ========================
# Default route
# ========================
@app.route("/")
def index():
    return {"message": "ArcFace AI Attendance Backend Running 🚀"}

# ========================
# Run app (development only)
# ========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)