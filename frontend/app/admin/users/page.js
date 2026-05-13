'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Edit, Trash2, Plus, Search, ArrowLeft, Save, X, Camera, RefreshCcw, User } from 'lucide-react';

export default function UserManagement() {
  const router = useRouter();
  
  // State Data Master
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State Form & Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nik: '',
    nama_lengkap: '',
    email: '',
    password: '',
    role: 'karyawan',
    is_dynamic: false,
    branch_id: '',
    image_base64: ''
  });

  // State Kamera HRD
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev';

  // --- 1. FETCH DATA (Users & Branches) ---
  const fetchMasterData = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return router.push('/');

      const headers = { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' };
      

      const [resUsers, resBranches] = await Promise.all([
        axios.get(`${API_URL}/admin/users`, { headers }),
        axios.get(`${API_URL}/admin/branches`, { headers })
      ]);

      setUsers(resUsers.data);
      setBranches(resBranches.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401 || err.response?.status === 403) router.push('/');
    } finally {
      // Menaruh setLoading di finally memastikan ia dipanggil secara Async
      setLoading(false); 
    }
  }, [router]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  useEffect(() => {
  return () => {
    stopCamera();
  };
}, []);

  // --- 2. LOGIKA KAMERA ENROLLMENT ---
  const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    console.log("REF:", videoRef.current);

    if (!videoRef.current) {
      console.log("videoRef NULL");
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsCameraActive(true);
      console.log("Camera ACTIVE");
    }

  } catch (err) {
    alert("Gagal mengakses kamera laptop HRD: " + err.message);
  }
};

  const stopCamera = () => {
  if (videoRef.current && videoRef.current.srcObject) {
    const tracks = videoRef.current.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    videoRef.current.srcObject = null;
  }
  setIsCameraActive(false);
};

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      setFormData(prev => ({ ...prev, image_base64: base64Image }));
      stopCamera();
    }
  };

  // Matikan kamera saat modal ditutup
  useEffect(() => {
    if (!showModal) stopCamera();
  }, [showModal]);


  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Batasi maksimal 5MB
        alert("Ukuran foto terlalu besar! Maksimal 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image_base64: reader.result }));
        stopCamera(); // Matikan kamera laptop jika sedang menyala
      };
      reader.readAsDataURL(file);
    }
  };

  // --- 3. HANDLER CRUD ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingId && !formData.image_base64) {
      alert("Pendaftaran gagal! Anda WAJIB mengambil foto wajah karyawan untuk data Biometrik.");
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const payload = { ...formData };
      
      // Bypass branch jika fleksibel
      if (payload.is_dynamic) payload.branch_id = null;
      else if (!payload.branch_id) payload.branch_id = branches.length > 0 ? branches[0].branch_id : null;

      const headers = { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' };

      if (editingId){
        if (!payload.password) delete payload.password;
        if (!payload.image_base64) delete payload.image_base64;

        await axios.put(`${API_URL}/admin/users/${editingId}`, payload, {headers});
        alert("Data Karyawan berhasil diperbarui!");

      }else{
        await axios.post('https://nondeliberately-subordinal-maximina.ngrok-free.dev/admin/users', payload, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        alert("Akun Karyawan dan Data Wajah berhasil didaftarkan!");
      }
      
      stopCamera();
      setShowModal(false);
      fetchMasterData(); 
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Terjadi kesalahan saat mendaftar user.");
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Yakin ingin menghapus karyawan ini dan data wajahnya secara permanen?")) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      fetchMasterData(); 
    } catch (err) {
      alert(err.response?.data?.error || "Gagal menghapus user");
    }
  };

  const openAddModal = () => {
    setEditingId(null)
    setFormData({ 
      nik: '',
      nama_lengkap: '', email: '', password: '', role: 'karyawan', 
      is_dynamic: false, branch_id: branches.length > 0 ? branches[0].branch_id : '', 
      image_base64: '' 
    });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingId(user.user_id);
    setFormData({
      nik: user.nik || '', 
      nama_lengkap: user.nama_lengkap,
      email: user.email,
      password: '', // Kosongkan, HRD tidak perlu tahu password lama
      role: user.role,
      is_dynamic: user.is_dynamic,
      branch_id: user.branch_id || (branches.length > 0 ? branches[0].branch_id : ''),
      image_base64: '' // Kosongkan, kamera disembunyikan sampai HRD mau foto ulang
    });
    setShowModal(true);
  };

  const filteredUsers = users.filter(u => 
    u.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Page */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-800">Manajemen Karyawan AI</h1>
              <p className="text-sm font-medium text-gray-500">Kelola Identitas, Mode Presensi, dan Pendaftaran Wajah.</p>
            </div>
          </div>
          <button onClick={openAddModal} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200 active:scale-95 w-full md:w-auto justify-center">
            <Plus size={18} /> Pendaftaran Baru
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Cari nama atau email..." 
            className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm text-black"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                <tr>
                  <th className="p-5">Profil Karyawan</th>
                  <th className="p-5 text-center">Tingkat Akses</th>
                  <th className="p-5 text-center">Mode Mobilitas</th>
                  <th className="p-5">Penempatan Cabang</th>
                  <th className="p-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="5" className="p-12 text-center font-medium text-gray-500">Memuat Database...</td></tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.user_id} className="hover:bg-blue-50/50 transition">
                      <td className="p-5">
                        <p className="font-bold text-gray-800 text-base">{user.nama_lengkap}</p>
                        <p className="text-gray-500 text-xs font-medium mt-0.5">{user.email}</p>
                      </td>
                      <td className="p-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          user.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        <span className={`px-3 py-1 rounded text-xs font-bold ${
                          user.is_dynamic ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {user.is_dynamic ? 'DINAMIS (Bypass GPS)' : 'STATIS (Terikat GPS)'}
                        </span>
                      </td>
                      <td className="p-5 font-medium text-gray-700">
                        {user.is_dynamic ? (
                           <span className="text-indigo-500 italic text-xs">Seluruh Area</span>
                        ) : (
                          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> {user.branch}</span>
                        )}
                      </td>
                      <td className="p-5">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openEditModal(user)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-lg transition" title="Edit Data">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDelete(user.user_id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition" title="Hapus">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" className="p-12 text-center text-gray-400 font-medium">Data tidak ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL FORM ENROLLMENT --- */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="font-black text-xl text-gray-800">
                {editingId ? "Edit Data Karyawan" : "Registrasi Karyawan Baru"}
              </h3>
              <button onClick={() => {stopCamera(); setShowModal(false);}} className="p-2 bg-white rounded-full border border-gray-200 hover:bg-red-50 hover:text-red-500 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6">
              <form id="enrollForm" onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. BAGIAN KAMERA BIOMETRIK (KIRI/ATAS) */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center">
                  <h4 className="font-bold text-blue-800 mb-3 text-sm flex justify-center items-center gap-2">
                    <User size={18}/> Pendaftaran Wajah Biometrik (Wajib)
                  </h4>
                  {editingId && <p className="text-xs text-blue-600 font-medium mb-3">(Biarkan jika tidak ingin mengubah foto wajah lama)</p>}
                  {!editingId && <p className="text-xs text-blue-600 font-medium mb-3">(Wajib dilakukan untuk karyawan baru)</p>}
                  
                  {formData.image_base64 ? (
                    <div className="relative inline-block">
                      <img src={formData.image_base64} alt="Wajah Karyawan" className="rounded-xl w-64 h-64 object-cover border-4 border-white shadow-md mx-auto" />
                      <button type="button" onClick={() => setFormData({...formData, image_base64: ''})} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600">
                        <RefreshCcw size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="relative w-64 h-64 bg-black rounded-xl overflow-hidden shadow-inner mx-auto mb-4 border-2 border-gray-300">
                        {/* VIDEO SELALU ADA */}
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover transform scale-x-[-1] ${
                            isCameraActive ? 'block' : 'hidden'
                          }`}
                        ></video>

                        {/* PLACEHOLDER */}
                        {!isCameraActive && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <Camera size={40} className="mb-2 opacity-50" />
                            <span className="text-xs font-medium px-4 text-center">
                              {editingId ? "Klik 'Nyalakan Kamera' jika ingin mengganti wajah." : "Kamera belum aktif. Pastikan wajah terlihat jelas."}
                            </span>
                          </div>
                        )}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                      </div>

                      {!isCameraActive ? (
                        <div className="flex flex-col items-center gap-3 w-full max-w-[256px] mt-2">
                          <button type="button" onClick={startCamera} className="w-full justify-center bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-black transition flex gap-2 items-center">
                            <Camera size={16}/> Gunakan Kamera Laptop
                          </button>
                          
                          {/* --- TAMBAHAN TOMBOL UPLOAD --- */}
                          <div className="flex items-center w-full gap-2">
                            <hr className="flex-1 border-gray-300" />
                            <span className="text-[10px] text-gray-400 font-black uppercase">Atau</span>
                            <hr className="flex-1 border-gray-300" />
                          </div>
                          
                          <button type="button" onClick={() => fileInputRef.current.click()} className="w-full justify-center bg-indigo-50 text-indigo-700 border border-indigo-200 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-100 transition flex gap-2 items-center">
                            <User size={16}/> Upload Foto HD
                          </button>
                          
                          {/* Input file yang disembunyikan */}
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/jpeg, image/png, image/jpg" 
                            onChange={handleFileUpload} 
                          />
                        </div>
                      ) : (
                        <button type="button" onClick={capturePhoto} className="bg-green-600 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-green-700 transition flex gap-2 items-center shadow-lg shadow-green-200 animate-pulse mt-2">
                          Ambil Wajah
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. BAGIAN DATA DIRI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">NIK KTP (16 Digit)</label>
                  <input 
                    required 
                    type="text" 
                    maxLength="16"
                    className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-medium"
                    value={formData.nik} 
                    onChange={e => {
                      // Opsional: Validasi agar hanya bisa ketik angka
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({...formData, nik: value});
                    }} 
                    placeholder="Masukkan 16 digit NIK"
                  />
                </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Lengkap</label>
                    <input required type="text" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-medium"
                      value={formData.nama_lengkap} onChange={e => setFormData({...formData, nama_lengkap: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Valid</label>
                    <input required type="email" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-medium"
                      value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password Login {editingId && <span className="text-orange-500 lowercase normal-case">(Kosongkan jika tak diubah)</span>}</label>
                    <input type="password" required={!editingId} className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-medium"
                      value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={editingId ? "Ketik jika ingin reset password" : ""} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tingkat Akses (Role)</label>
                    <select className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-bold"
                      value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                      <option value="karyawan">Karyawan Biasa</option>
                      <option value="admin">Admin / HRD</option>
                    </select>
                  </div>
                </div>

                {/* 3. BAGIAN LOKASI & MOBILITAS */}
                <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm">
                  
                  {/* Desain Toggle Switch On/Off */}
                  <div 
                    className="flex items-center justify-between mb-4 cursor-pointer group"
                    onClick={() => setFormData({...formData, is_dynamic: !formData.is_dynamic})}
                  >
                    <div>
                      <span className="font-bold text-gray-800 text-sm block">Mode Dinamis (Bypass Geofencing)</span>
                      <span className="text-xs text-gray-500 font-medium mt-0.5 block">
                        Aktifkan untuk pegawai dengan mobilitas kerja tinggi yang tidak diwajibkan berada dalam area geofence tertentu.
                      </span>
                    </div>
                    
                    {/* Komponen Toggle Tailwind Murni */}
                    <div className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none ${
                      formData.is_dynamic ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
                        formData.is_dynamic ? 'translate-x-8' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>

                  {/* Efek Transisi untuk Dropdown Cabang */}
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    formData.is_dynamic ? 'max-h-0 opacity-0' : 'max-h-24 opacity-100 mt-4 border-t border-gray-100 pt-4'
                  }`}>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pilih Cabang Penempatan</label>
                    <select 
                      required={!formData.is_dynamic} 
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-bold"
                      value={formData.branch_id} 
                      onChange={e => setFormData({...formData, branch_id: e.target.value})}
                    >
                      <option value="" disabled>-- Pilih Cabang Utama --</option>
                      {branches.map(b => (
                        <option key={b.branch_id} value={b.branch_id}>{b.nama_cabang}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </form>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition">
                Batal
              </button>
              <button type="submit" form="enrollForm" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition flex justify-center gap-2 items-center shadow-lg shadow-blue-200 active:scale-95">
                <Save size={18} /> {editingId ? "Update Data" : "Simpan Akun"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}