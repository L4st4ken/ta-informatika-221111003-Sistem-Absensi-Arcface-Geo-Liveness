# wsgi.py
from app import app
from config import Config

if __name__ == "__main__":
    # Hanya dijalankan jika langsung dieksekusi
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
