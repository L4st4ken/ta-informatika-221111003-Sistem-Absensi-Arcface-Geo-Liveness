'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Trash2, Edit, Plus, MapPin, ArrowLeft, Save, X, Navigation } from 'lucide-react';

export default function BranchManagement() {
  const router = useRouter();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    branch_id: '',
    nama_cabang: '',
    latitude: '',
    longitude: '',
    radius_meter: 50
  });

  const fetchBranches = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) { router.push('/login'); return; }

      const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev'; // Sesuaikan jika pakai Ngrok

      const res = await axios.get(`${API_URL}/branches/`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      setBranches(res.data);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem('access_token');
          router.push('/login');
      }
    } finally {
        setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev';
    
    try {
      if (isEditMode) {
        await axios.put(`${API_URL}/branches/${formData.branch_id}/update`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        alert("Cabang berhasil diupdate!");
      } else {
        await axios.post(`${API_URL}/branches/create`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        alert("Cabang berhasil ditambahkan!");
      }
      setShowModal(false);
      fetchBranches();
    } catch (err) {
      alert(err.response?.data?.error || "Terjadi kesalahan sistem");
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Yakin ingin menghapus cabang ini secara permanen?")) return;
    try {
      const token = localStorage.getItem('access_token');
      const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev';
      await axios.delete(`${API_URL}/branches/${id}/delete`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      fetchBranches();
    } catch (err) {
      alert(err.response?.data?.error || "Gagal menghapus cabang. Pastikan tidak ada karyawan statis yang terikat ke cabang ini.");
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData({
          ...formData,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      }, (err) => {
        alert("Gagal membaca GPS. Pastikan Izin Lokasi diaktifkan pada browser Anda.");
      }, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    } else {
      alert("Browser Anda tidak mendesukung fitur Geolocation.");
    }
  };

  const openAddModal = () => {
    setFormData({ branch_id: '', nama_cabang: '', latitude: '', longitude: '', radius_meter: 50 });
    setIsEditMode(false);
    setShowModal(true);
  };

  const openEditModal = (b) => {
    setFormData({
        branch_id: b.branch_id,
        nama_cabang: b.nama_cabang,
        latitude: b.latitude,
        longitude: b.longitude,
        radius_meter: b.radius_meter
    });
    setIsEditMode(true);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-800">Manajemen Titik Lokasi (Geofencing)</h1>
              <p className="text-sm font-medium text-gray-500">Kelola daftar koordinat GPS Kantor Pusat dan Cabang.</p>
            </div>
          </div>
          <button onClick={openAddModal} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200 active:scale-95 w-full md:w-auto">
            <Plus size={18} /> Tambah Lokasi Baru
          </button>
        </div>

        {/* List Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? <p className="text-center col-span-full mt-10 text-gray-400 font-medium animate-pulse">Memuat Database Lokasi...</p> : 
           branches.length > 0 ? branches.map((b) => (
            <div key={b.branch_id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition flex flex-col h-full group">
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="bg-orange-50 p-3.5 rounded-xl text-orange-600 border border-orange-100 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{b.nama_cabang}</h3>
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">ID LOKASI: {b.branch_id}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                  <button onClick={() => openEditModal(b)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition" title="Edit"><Edit size={16}/></button>
                  <button onClick={() => handleDelete(b.branch_id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition" title="Hapus"><Trash2 size={16}/></button>
                </div>
              </div>
              
              {/* Info Koordinat Terstruktur */}
              <div className="mt-auto space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold uppercase tracking-wider">Latitude (Lintang)</span>
                  <span className="font-mono font-medium text-gray-700 bg-white px-2 py-1 rounded border border-gray-200">{b.latitude}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold uppercase tracking-wider">Longitude (Bujur)</span>
                  <span className="font-mono font-medium text-gray-700 bg-white px-2 py-1 rounded border border-gray-200">{b.longitude}</span>
                </div>
                <div className="border-t border-gray-200/60 my-2"></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold uppercase tracking-wider">Radius Aktif</span>
                  <span className="font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                    {b.radius_meter} Meter
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center">
              <p className="text-gray-500 font-medium mb-2">Belum ada titik lokasi yang didaftarkan.</p>
              <p className="text-xs text-gray-400">Silakan tambah lokasi agar fitur Geofencing dapat digunakan.</p>
            </div>
          )}
        </div>

      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transform transition-all">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-xl text-gray-800">{isEditMode ? 'Edit Lokasi' : 'Tambah Lokasi Baru'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 bg-white rounded-full border border-gray-200 hover:bg-red-50 hover:text-red-500 transition"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Area / Cabang</label>
                <input required type="text" placeholder="Misal: Kantor Pusat Malang" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-medium"
                  value={formData.nama_cabang} onChange={e => setFormData({...formData, nama_cabang: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Latitude</label>
                  <input required type="number" step="any" placeholder="-7.983908" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-mono font-medium"
                    value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Longitude</label>
                  <input required type="number" step="any" placeholder="112.621391" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-mono font-medium"
                    value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} />
                </div>
              </div>

              {/* Tombol Ambil Lokasi (Akurasi Tinggi) */}
              <button type="button" onClick={getCurrentLocation} className="w-full py-3 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center gap-2 transition shadow-sm active:scale-95">
                <Navigation size={16} className="text-indigo-600"/> Isi Dengan Posisi GPS Saya Saat Ini
              </button>

              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <label className="block text-xs font-bold text-green-800 uppercase tracking-wider mb-2">Radius Geofence (Meter)</label>
                <input required type="number" className="w-full border border-green-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-600 transition text-sm font-bold text-green-900"
                  value={formData.radius_meter} onChange={e => setFormData({...formData, radius_meter: e.target.value})} />
                <p className="text-[11px] text-green-700 mt-2 font-medium leading-relaxed">
                  Batas jarak aman agar absensi diterima. Rekomendasi: <strong>50 - 100 meter</strong> untuk mengantisipasi ketidakakuratan GPS pada Smartphone.
                </p>
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100">
                <button type="submit" className="w-full bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-700 transition flex justify-center gap-2 items-center shadow-lg shadow-blue-200 active:scale-95">
                  <Save size={18} /> {isEditMode ? 'Simpan Perubahan' : 'Buat Titik Lokasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}