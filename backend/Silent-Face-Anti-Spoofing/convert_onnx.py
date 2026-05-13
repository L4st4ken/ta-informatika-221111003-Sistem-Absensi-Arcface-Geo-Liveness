import torch
import os
from collections import OrderedDict
from src.model_lib.MiniFASNet import MiniFASNetV2

print("⏳ Memulai Konversi Model MiniFASNetV2 ke ONNX...")

# 1. Path model bawaan (.pth)
model_path = "resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth"

# 2. Inisialisasi Arsitektur
model = MiniFASNetV2(conv6_kernel=(5, 5))

# 3. Muat bobot (weights) ke dalam memori CPU
state_dict = torch.load(model_path, map_location=torch.device('cpu'))

# ========================================================
# FIX ERROR: Menghapus prefix "module." dari nama layer
# ========================================================
new_state_dict = OrderedDict()
for key, value in state_dict.items():
    # Jika nama key berawalan 'module.', potong 7 karakter pertamanya
    name_key = key[7:] if key.startswith('module.') else key
    new_state_dict[name_key] = value

# Masukkan state_dict yang sudah bersih ke dalam model
model.load_state_dict(new_state_dict)
# ========================================================

# PENTING: Ubah model ke mode Evaluasi (bukan mode Training)
model.eval()

# 4. Buat gambar palsu (dummy input) berukuran 80x80 pixels, 3 channels (RGB)
dummy_input = torch.randn(1, 3, 80, 80)

# 5. Proses Export ke ONNX
onnx_filename = "minifasnet_v2.onnx"
torch.onnx.export(
    model,                      
    dummy_input,                
    onnx_filename,              
    export_params=True,         
    opset_version=11,           
    do_constant_folding=True,   
    input_names=['input'],      
    output_names=['output'],    
    dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
)

print(f"🎉 BERHASIL! File ONNX telah tercipta dengan nama: {onnx_filename}")