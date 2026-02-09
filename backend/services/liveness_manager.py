import threading
import time
import random
from services.liveness_service import LivenessService
from config import Config

class LivenessSession:
    def __init__(self, predictor, target_blinks):
        self.ls = LivenessService(predictor)
        self.ls.reset(target_blinks)
        self.target_blinks = target_blinks
        self.last_frame = None
        self.last_seen = time.time()

    def update_seen(self):
        self.last_seen = time.time()

class LivenessManager:
    def __init__(self, predictor, ttl=15):
        self.sessions = {}
        self.predictor = predictor
        self.ttl = ttl
        t = threading.Thread(target=self._cleanup_loop, daemon=True)
        t.start()

    def _generate_random_target(self):
        try:
            mn, mx = int(Config.LIVENESS_BLINK_MIN), int(Config.LIVENESS_BLINK_MAX)
            if mn > mx: mn, mx = mx, mn
            return random.randint(mn, mx)
        except:
            return 3

    def start_session(self, user_id, target_blinks=None):
        if target_blinks is None:
            target_blinks = self._generate_random_target()
        session = LivenessSession(self.predictor, target_blinks)
        self.sessions[user_id] = session
        return session

    def get_session(self, user_id):
        return self.sessions.get(user_id)

    def end_session(self, user_id):
        return self.sessions.pop(user_id, None)

    def _cleanup_loop(self):
        while True:
            now = time.time()
            to_del = [uid for uid, s in list(self.sessions.items()) if now - s.last_seen > self.ttl]
            for uid in to_del:
                self.sessions.pop(uid, None)
            time.sleep(2)
