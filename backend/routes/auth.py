from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token, 
    jwt_required, 
    get_jwt_identity, 
    get_jwt
)

from models.models import User
from database.connection import get_db

auth_bp = Blueprint("auth_bp", __name__, url_prefix="/auth")

# ==========================================
# 1. LOGIN USER
# ==========================================
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    if not data or not all(k in data for k in ("email", "password")):
        return jsonify({"error": "Data login tidak lengkap"}), 400

    db: Session = next(get_db())
    user = db.query(User).filter_by(email=data["email"]).first()
    
    if not user or not check_password_hash(user.password_hash, data["password"]):
        return jsonify({"error": "Email atau Password salah!"}), 401

    # Buat JWT Stateless (Tanpa simpan ke Database)
    access_token = create_access_token(
        identity=str(user.user_id), 
        additional_claims={"role": user.role}
    )

    refresh_token = create_refresh_token(
        identity=str(user.user_id),
        additional_claims={"role": user.role}
    )   

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "user_id": user.user_id,
            "nama_lengkap": user.nama_lengkap,
            "email": user.email,
            "role": user.role,
            "branch_id": user.branch_id,
            # KUNCI FRONTEND: Kirim status fleksibel agar HP tahu harus cek GPS atau tidak
            "is_dynamic": user.is_dynamic 
        }
    }), 200

# ==========================================
# 2. REFRESH TOKEN (STATELESS)
# ==========================================
@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    claims = get_jwt()
    
    new_access = create_access_token(
        identity=str(user_id), 
        additional_claims={"role": claims.get("role")}
    )
    return jsonify({"access_token": new_access}), 200
    
# ==========================================
# 3. GET CURRENT USER INFO (ME)
# ==========================================
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    db: Session = next(get_db())
    user = db.query(User).filter_by(user_id=user_id).first()
    
    if not user:
        return jsonify({"error": "User tidak ditemukan"}), 404
        
    return jsonify({
        "user_id": user.user_id,
        "nama_lengkap": user.nama_lengkap,
        "email": user.email,
        "role": user.role,
        "branch_id": user.branch_id,
        "is_dynamic": user.is_dynamic
    }), 200