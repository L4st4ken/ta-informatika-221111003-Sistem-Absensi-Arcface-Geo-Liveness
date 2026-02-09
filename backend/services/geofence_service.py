from geopy.distance import great_circle
from utils.validation import validate_geofence
from models.models import Branch

class GeofenceService:
    def __init__(self, db):
        self.db = db

    def get_branch(self, branch_id):
        return self.db.query(Branch).filter(Branch.branch_id==branch_id).first()

    def is_inside_geofence(self,user_lat,user_long,branch_id,radius_meter=None):
        branch=self.get_branch(branch_id)
        if not branch: return False, 99999
        return validate_geofence(user_lat,user_long,{
            "latitude":branch.latitude,
            "longitude":branch.longitude,
            "radius_meter":branch.radius_meter
        }, radius_meter)

    def get_distance_to_branch(self,user_lat,user_long,branch_id):
        branch=self.get_branch(branch_id)
        if not branch: return 99999
        return great_circle((branch.latitude,branch.longitude),(user_lat,user_long)).meters
