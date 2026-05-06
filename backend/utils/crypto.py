# utils/crypto.py
# Belum dipakai projek

from cryptography.fernet import Fernet, InvalidToken
import base64
import os

# Load key from env or generate temp key for dev
FERNET_KEY = os.getenv("FERNET_KEY")
if not FERNET_KEY:
    # in dev, create ephemeral key (NOT for prod)
    FERNET_KEY = base64.urlsafe_b64encode(os.urandom(32)).decode()
fernet = Fernet(FERNET_KEY.encode())

def encrypt_embedding(plain_json_str: str) -> str:
    token = fernet.encrypt(plain_json_str.encode())
    return token.decode()

def decrypt_embedding(token_str: str) -> str:
    try:
        plain = fernet.decrypt(token_str.encode())
        return plain.decode()
    except InvalidToken as e:
        raise
