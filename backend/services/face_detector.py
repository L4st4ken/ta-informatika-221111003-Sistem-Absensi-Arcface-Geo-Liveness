import cv2
import numpy as np
import os
import onnxruntime as ort

class FaceDetector:
    def __init__(self, model_dir="models", model_name="det_500m.onnx"):
        self.model_path = os.path.join(model_dir, model_name)
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model not found: {self.model_path}")
        
        providers = ['CPUExecutionProvider']
        self.session = ort.InferenceSession(self.model_path, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        
        self.input_size = (640, 640)
        self.strides = [8, 16, 32]

    def detect_faces(self, img_bgr, conf_thresh=0.5, nms_thresh=0.4):
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        orig_h, orig_w = img_rgb.shape[:2]
        
        # Resize & Preprocess
        img_resized, ratio = self.resize_image(img_rgb, self.input_size)
        blob = cv2.dnn.blobFromImage(img_resized, 1.0/128.0, self.input_size, (127.5, 127.5, 127.5), swapRB=False)
        
        outputs = self.session.run(None, {self.input_name: blob[0][None]})
        
        # Mapping Output
        scores_list = outputs[0:3]
        bboxes_list = outputs[3:6]
        
        pred_boxes = []
        pred_scores = []

        for idx, stride in enumerate(self.strides):
            scores = scores_list[idx] 
            bbox_preds = bboxes_list[idx]
            
            # Ensure 2D shape (N, 1) or (N, 4)
            if scores.ndim == 3: scores = scores[0]
            if bbox_preds.ndim == 3: bbox_preds = bbox_preds[0]
            
            # 1. Generate Grid Anchor (Single)
            height, width = self.input_size[0] // stride, self.input_size[1] // stride
            anchor_centers = np.stack(np.mgrid[:height, :width][::-1], axis=-1).astype(np.float32)
            anchor_centers = (anchor_centers * stride).reshape((-1, 2))
            
            # 2. --- FIX ERROR DISINI ---
            # Cek rasio jumlah prediksi vs jumlah grid
            # Jika 800 prediksi vs 400 grid, berarti num_anchors = 2
            num_anchors = scores.shape[0] // anchor_centers.shape[0]
            
            if num_anchors > 1:
                # Duplikasi anchor secara interleaved (A, A, B, B...) agar cocok dengan urutan output model
                anchor_centers = np.stack([anchor_centers]*num_anchors, axis=1).reshape((-1, 2))
            
            # 3. Filtering
            mask = scores[:, 0] > conf_thresh
            if not np.any(mask): continue
            
            valid_scores = scores[mask]
            valid_bbox_preds = bbox_preds[mask]
            valid_anchors = anchor_centers[mask] # Sekarang ukurannya sudah sama!
            
            # 4. Decode Boxes
            x1 = valid_anchors[:, 0] - valid_bbox_preds[:, 0] * stride
            y1 = valid_anchors[:, 1] - valid_bbox_preds[:, 1] * stride
            x2 = valid_anchors[:, 0] + valid_bbox_preds[:, 2] * stride
            y2 = valid_anchors[:, 1] + valid_bbox_preds[:, 3] * stride
            
            decoded_boxes = np.stack([x1, y1, x2, y2], axis=-1)
            pred_boxes.append(decoded_boxes)
            pred_scores.append(valid_scores)

        if not pred_boxes:
            return []

        pred_boxes = np.concatenate(pred_boxes, axis=0)
        pred_scores = np.concatenate(pred_scores, axis=0)

        # 5. NMS
        boxes_xywh = pred_boxes.copy()
        boxes_xywh[:, 2] = boxes_xywh[:, 2] - boxes_xywh[:, 0] # w
        boxes_xywh[:, 3] = boxes_xywh[:, 3] - boxes_xywh[:, 1] # h
        
        indices = cv2.dnn.NMSBoxes(boxes_xywh.tolist(), pred_scores.flatten().tolist(), conf_thresh, nms_thresh)

        final_boxes = []
        if len(indices) > 0:
            for i in indices.flatten():
                box = pred_boxes[i]
                box /= ratio # Scale back
                x1, y1, x2, y2 = box.astype(int)
                
                x1 = max(0, x1); y1 = max(0, y1)
                x2 = min(orig_w, x2); y2 = min(orig_h, y2)
                
                final_boxes.append([x1, y1, x2, y2])
        
        return final_boxes

    def resize_image(self, img, target_size):
        h, w = img.shape[:2]
        scale = min(target_size[0] / h, target_size[1] / w)
        new_h, new_w = int(h * scale), int(w * scale)
        resized = cv2.resize(img, (new_w, new_h))
        canvas = np.zeros((target_size[0], target_size[1], 3), dtype=np.uint8)
        canvas[:new_h, :new_w] = resized
        return canvas, scale

    def crop_face(self, img_bgr, box, margin=0.2, min_size=32):
        x1, y1, x2, y2 = box
        w = max(1, x2 - x1)
        h = max(1, y2 - y1)
        mx = int(w * margin)
        my = int(h * margin)
        sx = max(0, x1 - mx)
        sy = max(0, y1 - my)
        ex = min(img_bgr.shape[1], x2 + mx)
        ey = min(img_bgr.shape[0], y2 + my)
        
        face = img_bgr[sy:ey, sx:ex].copy()
        if face.shape[0] < min_size or face.shape[1] < min_size:
            return cv2.resize(face, (min_size, min_size))
        return face

    def pick_largest(self, boxes):
        if not boxes: return None
        return sorted(boxes, key=lambda b: (b[2]-b[0])*(b[3]-b[1]), reverse=True)[0]