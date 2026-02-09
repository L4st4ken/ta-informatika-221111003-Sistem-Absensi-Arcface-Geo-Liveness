# utils/validation.py
import base64
import numpy as np
import cv2
import math

def decode_image(base64_string):
    """Decode base64 string to OpenCV image"""
    try:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        decoded_data = base64.b64decode(base64_string)
        np_data = np.frombuffer(decoded_data, np.uint8)
        img = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"Error decoding image: {e}")
        return None

def calculate_face_similarity(embedding1, embedding2, threshold=0.45):
    """Cosine Similarity"""
    if embedding1 is None or embedding2 is None:
        return 0.0, False
        
    emb1 = np.array(embedding1).flatten()
    emb2 = np.array(embedding2).flatten()

    norm1 = np.linalg.norm(emb1)
    norm2 = np.linalg.norm(emb2)

    if norm1 == 0 or norm2 == 0:
        return 0.0, False

    similarity = np.dot(emb1, emb2) / (norm1 * norm2)
    return float(similarity), bool(similarity > threshold)

# --- GEOLOCATION LOGIC ---

def haversine_distance(lat1, lon1, lat2, lon2):
    """Menghitung jarak (meter) antara 2 koordinat"""
    R = 6371000  # Radius bumi dalam meter
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def validate_geofence(user_lat, user_lon, office_data):
    """
    Cek apakah user ada di dalam radius kantor.
    office_data dict harus punya: 'latitude', 'longitude', 'radius_meter'
    """
    if user_lat is None or user_lon is None:
        return False, 999999 # Jarak tak terhingga

    office_lat = office_data.get("latitude")
    office_lon = office_data.get("longitude")
    radius = office_data.get("radius_meter", 50)

    if office_lat is None or office_lon is None:
        return False, 0 # Data kantor tidak valid

    distance = haversine_distance(user_lat, user_lon, office_lat, office_lon)
    is_inside = distance <= radius
    
    return is_inside, distance