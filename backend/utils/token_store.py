# utils/token_store.py
# Belum dipakai projek
from models.models import RefreshToken
from database.connection import SessionLocal
from datetime import datetime, timedelta

def store_refresh_token(jti: str, user_id: int, expires_delta, device_info: str = None):
    db = SessionLocal()
    try:
        expires_at = datetime.utcnow() + expires_delta
        rt = RefreshToken(jti=jti, user_id=user_id, expires_at=expires_at, device_info=device_info, revoked=False)
        db.add(rt)
        db.commit()
        return rt
    finally:
        db.close()

def revoke_refresh_token(jti: str):
    db = SessionLocal()
    try:
        rec = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
        if rec:
            rec.revoked = True
            db.commit()
            return True
        return False
    finally:
        db.close()

def revoke_all_user_refresh_tokens(user_id: int):
    db = SessionLocal()
    try:
        db.query(RefreshToken).filter(RefreshToken.user_id == user_id, RefreshToken.revoked == False).update({"revoked": True})
        db.commit()
    finally:
        db.close()

def is_refresh_token_active(jti: str):
    db = SessionLocal()
    try:
        rec = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
        if not rec:
            return False
        if rec.revoked:
            return False
        if rec.expires_at < datetime.utcnow():
            return False
        return True
    finally:
        db.close()
