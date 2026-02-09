import numpy as np
import cv2
import onnxruntime as ort

class FaceService:
    def __init__(self, model_path="models/w600k_mbf.onnx"):
        try:
            self.session = ort.InferenceSession(model_path)
            self.input_name = self.session.get_inputs()[0].name
            self.input_shape = self.session.get_inputs()[0].shape
            print(f"OK ONNX model loaded: {model_path}")
        except Exception as e:
            print(f"Failed to load ONNX model: {e}")
            self.session = None

    def preprocess(self, img_bgr):
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (112, 112))
        img_norm = (img_resized.astype(np.float32) - 127.5) / 128.0
        img_transposed = np.transpose(img_norm, (2,0,1))
        img_batch = np.expand_dims(img_transposed, axis=0).astype(np.float32)
        return img_batch

    def get_embedding(self, img_bgr):
        if self.session is None: return None
        img_input = self.preprocess(img_bgr)
        try:
            emb = self.session.run(None, {self.input_name: img_input})[0].flatten()
            norm = np.linalg.norm(emb)
            if norm>0: emb /= norm
            return emb
        except Exception as e:
            print("Get embedding error:", e)
            return None

face_service = FaceService()
