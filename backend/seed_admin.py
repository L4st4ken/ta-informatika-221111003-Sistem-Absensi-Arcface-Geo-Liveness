from database.connection import get_db
from models.models import User
from werkzeug.security import generate_password_hash

def create_super_admin():
    db = next(get_db())
    
    # Cek apakah admin sudah ada
    existing_admin = db.query(User).filter_by(email="admin@gmail.com").first()
    if existing_admin:
        print("[INFO] Akun Admin sudah ada di database.")
        return

    # Buat Admin Baru
    admin = User(
        nik="ADM-001",
        nama_lengkap="Super Admin HRD",
        email="admin@gmail.com",
        password_hash=generate_password_hash("admin123"), # Password default
        role="admin",
        branch_id=None,
        marketing_flexible=False
    )
    
    try:
        db.add(admin)
        db.commit()
        print("[SUCCESS] Akun Admin berhasil dibuat!")
        print("Email    : admin@gmail.com")
        print("Password : admin123")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Gagal membuat admin: {e}")

if __name__ == "__main__":
    create_super_admin()