# Belum dipakai projek
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    unset_jwt_cookies,
)
import datetime

ACCESS_EXPIRES_MINUTES = 15
REFRESH_EXPIRES_DAYS = 7

def generate_access_token(identity, role):
    # --- FIX: Paksa identity jadi String ---
    identity = str(identity) 
    # ---------------------------------------
    return create_access_token(
        identity=identity,
        additional_claims={"role": role},
        expires_delta=datetime.timedelta(minutes=ACCESS_EXPIRES_MINUTES)
    )

def generate_refresh_token(identity, role):
    # --- FIX: Paksa identity jadi String ---
    identity = str(identity)
    # ---------------------------------------
    return create_refresh_token(
        identity=identity,
        additional_claims={"role": role},
        expires_delta=datetime.timedelta(days=REFRESH_EXPIRES_DAYS)
    )

def refresh_access_token(identity, role):
    # Di sini identity sudah string (karena diambil dari token lama), tapi double check gapapa
    new_token = generate_access_token(str(identity), role)
    return {"access_token": new_token}

def unset_tokens(response):
    unset_jwt_cookies(response)
    return response