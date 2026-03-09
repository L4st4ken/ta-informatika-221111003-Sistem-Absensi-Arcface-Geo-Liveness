# routes/auth.py
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, decode_token, set_access_cookies, set_refresh_cookies, get_jwt
# --- UPDATE IMPORT: Tambahkan Shift ---
from models.models import User, FaceEmbedding, Shift 
from database.connection import get_db
from services.face_service import face_service
from services.face_detector import FaceDetector
from utils.validation import decode_image
from utils.token_store import store_refresh_token, revoke_refresh_token, is_refresh_token_active
from datetime import timedelta
from config import Config
import json

auth_bp = Blueprint("auth_bp", __name__, url_prefix="/auth")
detector = FaceDetector(model_dir="models", model_name="det_500m.onnx")


def check_face_alignment(face_box, img_w, img_h):
    fx1, fy1, fx2, fy2 = face_box
    
    # 1. Deteksi Orientasi Kamera (Responsive Logic)
    is_portrait = img_h > img_w
    
    # Rasio ideal wajah manusia adalah sekitar 1 : 1.3 (Lebar : Tinggi)
    if is_portrait:
        # Jika di HP (Portrait): Jadikan LEBAR layar sebagai patokan
        box_w = int(img_w * 0.65)   # Kotak mengambil 65% dari lebar HP
        box_h = int(box_w * 1.3)    # Tingginya mengikuti rasio 1.3 dari lebar
    else:
        # Jika di Laptop (Landscape): Jadikan TINGGI layar sebagai patokan
        box_h = int(img_h * 0.65)   # Kotak mengambil 65% dari tinggi Laptop
        box_w = int(box_h / 1.3)    # Lebarnya mengikuti rasio pembagian 1.3

    # 2. Hitung Koordinat Kotak agar Pas di Tengah Layar
    gx1 = (img_w - box_w) // 2
    gy1 = (img_h - box_h) // 2
    gx2 = gx1 + box_w
    gy2 = gy1 + box_h
    guide_box = [gx1, gy1, gx2, gy2]

    # 3. Hitung Titik Tengah Wajah vs Titik Tengah Kotak
    fcx = (fx1 + fx2) // 2
    fcy = (fy1 + fy2) // 2
    gcx = (gx1 + gx2) // 2
    gcy = (gy1 + gy2) // 2
    
    diff_x = abs(fcx - gcx)
    diff_y = abs(fcy - gcy)
    
    # Toleransi melenceng (15% dari ukuran layar)
    limit_x = img_w * 0.15 
    limit_y = img_h * 0.15

    if diff_x > limit_x or diff_y > limit_y:
        return False, "Paskan Wajah di Tengah Kotak!", guide_box

    # 4. Validasi Jarak (Zoom)
    face_h = fy2 - fy1
    if face_h < box_h * 0.45: # Toleransi jarak agar di HP tidak perlu terlalu nempel
        return False, "Maju Dikit (Wajah Terlalu Jauh)", guide_box
        
    return True, "OK", guide_box

# -----------------------
# Register User (UPDATED)
# -----------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    # Validasi input dasar
    if not data or not all(k in data for k in ("nama_lengkap", "email", "password", "role")):
        return jsonify({"error": "Incomplete data"}), 400

    db: Session = next(get_db())
    
    # Cek duplikasi email
    if db.query(User).filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    try:
        # --- LOGIC TAMBAHAN: AUTO ASSIGN SHIFT & BRANCH ---
        
        # 1. Ambil Shift Default (Biasanya ID 1 / Pagi)
        # Agar user baru langsung punya jam kerja
        default_shift = db.query(Shift).order_by(Shift.shift_id.asc()).first()
        shift_id_to_assign = default_shift.shift_id if default_shift else None
        
        # 2. Ambil Branch ID dari request (Default ke 1 jika tidak ada)
        branch_id_to_assign = int(data.get("branch_id", 1))

        user = User(
            nama_lengkap=data["nama_lengkap"],
            email=data["email"],
            password_hash=generate_password_hash(data["password"]),
            role=data["role"],
            branch_id=branch_id_to_assign, # Simpan Branch
            shift_id=shift_id_to_assign    # Simpan Shift
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return jsonify({
            "msg": "User registered successfully", 
            "user_id": user.user_id,
            "branch_id": user.branch_id,
            "shift_id": user.shift_id
        }), 201
        
    except Exception as e:
        db.rollback()
        current_app.logger.error(f"Register user error: {e}")
        return jsonify({"error": f"Failed to register user: {e}"}), 500


# -----------------------
# Login User
# -----------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    if not data or not all(k in data for k in ("email", "password")):
        return jsonify({"error": "Incomplete data"}), 400

    db: Session = next(get_db())
    user = db.query(User).filter_by(email=data["email"]).first()
    
    if not user or not check_password_hash(user.password_hash, data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    # Generate Token (Identity harus String)
    access_token = create_access_token(
        identity=str(user.user_id), 
        additional_claims={"role": user.role}
    )

    refresh_token = create_refresh_token(
        identity=str(user.user_id),
        additional_claims={"role": user.role}
    )   

    # Store Refresh Token
    decoded_rt = decode_token(refresh_token)
    rt_jti = decoded_rt.get("jti")
    store_refresh_token(rt_jti, user.user_id, expires_delta=Config.JWT_REFRESH_TOKEN_EXPIRES, device_info=request.headers.get("User-Agent"))

    resp = jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "user_id": user.user_id,
            "nama_lengkap": user.nama_lengkap,
            "email": user.email,
            "role": user.role,
            "branch_id": user.branch_id # Kirim info branch juga berguna buat frontend
        }
    })
    set_access_cookies(resp, access_token)
    set_refresh_cookies(resp, refresh_token)
    return resp, 200


# -----------------------
# Upload Face Embedding
# -----------------------
@auth_bp.route("/upload-embedding", methods=["POST"])
@jwt_required()
def upload_embedding():
    current_user_id = get_jwt_identity()
    db: Session = next(get_db())
    user = db.query(User).filter_by(user_id=current_user_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if not request.json or "image_base64" not in request.json:
        return jsonify({"error": "No image provided"}), 400

    img = decode_image(request.json["image_base64"])
    if img is None:
        return jsonify({"error": "Invalid image"}), 400

    # ==========================================
    # LOGIKA BARU: DETEKSI DAN CROP WAJAH DULU!
    # ==========================================
    boxes = detector.detect_faces(img)
    if not boxes:
        return jsonify({"error": "Wajah tidak terdeteksi di kamera!"}), 400

    box = detector.pick_largest(boxes)
    
    # --- TAMBAHAN: VALIDASI KOTAK KUNING ---
    h, w, _ = img.shape
    is_aligned, align_msg, _ = check_face_alignment(box, w, h)
    
    if not is_aligned:
        return jsonify({"error": align_msg}), 400 # Tolak jika wajah melenceng/terlalu jauh
    # ---------------------------------------

    # Jika wajah sudah pas di tengah, baru di-crop
    crop_img = detector.crop_face(img, box, margin=0.25)

    # Ekstrak embedding dari wajah yang SUDAH DICROP
    embedding = face_service.get_embedding(crop_img)
    # ==========================================

    if embedding is None:
        return jsonify({"error": "Failed to extract face embedding"}), 500

    try:
        embedding_record = db.query(FaceEmbedding).filter_by(user_id=user.user_id).first()
        embedding_json = json.dumps(embedding.tolist())
        
        try:
            from utils.crypto import encrypt_embedding
            embedding_json = encrypt_embedding(embedding_json)
        except ImportError:
            pass 
            
        if embedding_record:
            embedding_record.embedding_data = embedding_json
        else:
            embedding_record = FaceEmbedding(user_id=user.user_id, embedding_data=embedding_json)
            db.add(embedding_record)

        db.commit()
        return jsonify({"msg": "Face embedding uploaded successfully"}), 200
    except Exception as e:
        db.rollback()
        current_app.logger.error(f"Upload embedding error: {e}")
        return jsonify({"error": f"Failed to save embedding: {e}"}), 500


@auth_bp.route("/get-embedding", methods=["GET"])
@jwt_required()
def get_embedding():
    current_user_id = get_jwt_identity()
    db: Session = next(get_db())
    embedding_record = db.query(FaceEmbedding).filter_by(user_id=current_user_id).first()
    if not embedding_record:
        return jsonify({"error": "No embedding found"}), 404

    return jsonify({
        "user_id": current_user_id,
        "embedding_data": embedding_record.embedding_data
    }), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    db_jti = get_jwt().get("jti")
    user_id = get_jwt_identity()

    if not is_refresh_token_active(db_jti):
        return jsonify({"error": "Refresh token revoked or expired"}), 401

    revoke_refresh_token(db_jti)

    new_access = create_access_token(identity=str(user_id), additional_claims={"role": get_jwt().get("role")})
    new_refresh = create_refresh_token(identity=str(user_id), additional_claims={"role": get_jwt().get("role")})
    
    new_decoded = decode_token(new_refresh)
    new_jti = new_decoded.get("jti")

    store_refresh_token(new_jti, user_id, expires_delta=Config.JWT_REFRESH_TOKEN_EXPIRES, device_info=request.headers.get("User-Agent"))

    resp = jsonify({"access_token": new_access, "refresh_token": new_refresh})
    return resp, 200

@auth_bp.route("/logout", methods=["POST"])
@jwt_required(refresh=True)
def logout():
    jti = get_jwt().get("jti")
    revoke_refresh_token(jti)
    return jsonify({"msg": "Logout success"}), 200