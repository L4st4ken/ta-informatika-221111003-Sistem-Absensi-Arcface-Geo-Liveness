'use client';

import { useState, useEffect } from 'react';
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

  // 1. FETCH DATA
  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/'); return; }

      const res = await axios.get('https://nondeliberately-subordinal-maximina.ngrok-free.dev/admin/branches', {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      setBranches(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. HANDLER
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    try {
      if (isEditMode) {
        await axios.put(`https://nondeliberately-subordinal-maximina.ngrok-free.dev/admin/branches/${formData.branch_id}`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        alert("Cabang berhasil diupdate!");
      } else {
        await axios.post('https://nondeliberately-subordinal-maximina.ngrok-free.dev/admin/branches', formData, {
          headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
        });
        alert("Cabang berhasil dibuat!");
      }
      setShowModal(false);
      fetchBranches();
    } catch (err) {
      alert(err.response?.data?.error || "Terjadi kesalahan");
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Hapus cabang ini?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`https://nondeliberately-subordinal-maximina.ngrok-free.dev/admin/branches/${id}`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      fetchBranches();
    } catch (err) {
      alert("Gagal menghapus cabang");
    }
  };

  // Helper: Get Current Location (Untuk memudahkan Admin set koordinat)
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData({
          ...formData,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      });
    } else {
      alert("Browser tidak support Geolocation");
    }
  };

  const openAddModal = () => {
    setFormData({ branch_id: '', nama_cabang: '', latitude: '', longitude: '', radius_meter: 50 });
    setIsEditMode(false);
    setShowModal(true);
  };

  const openEditModal = (b) => {
    setFormData(b);
    setIsEditMode(true);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-800">Manajemen Kantor Cabang</h1>
          </div>
          <button onClick={openAddModal} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            <Plus size={18} /> Tambah Cabang
          </button>
        </div>

        {/* List Cards (Lebih cocok daripada Tabel untuk Cabang) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? <p className="text-center col-span-2">Loading...</p> : branches.map((b) => (
            <div key={b.branch_id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{b.nama_cabang}</h3>
                    <p className="text-xs text-gray-500">ID: {b.branch_id}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(b)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={18}/></button>
                  <button onClick={() => handleDelete(b.branch_id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 space-y-2 bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between">
                  <span>Latitude:</span> <span className="font-mono">{b.latitude}</span>
                </div>
                <div className="flex justify-between">
                  <span>Longitude:</span> <span className="font-mono">{b.longitude}</span>
                </div>
                <div className="flex justify-between">
                  <span>Radius:</span> <span className="font-bold">{b.radius_meter} Meter</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-bounce-in">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">{isEditMode ? 'Edit Cabang' : 'Tambah Cabang'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-500 hover:text-red-500" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nama Cabang</label>
                <input required type="text" className="w-full border rounded-lg p-2"
                  value={formData.nama_cabang} onChange={e => setFormData({...formData, nama_cabang: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Latitude</label>
                  <input required type="number" step="any" className="w-full border rounded-lg p-2"
                    value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Longitude</label>
                  <input required type="number" step="any" className="w-full border rounded-lg p-2"
                    value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} />
                </div>
              </div>

              {/* Tombol Ambil Lokasi Saat Ini */}
              <button type="button" onClick={getCurrentLocation} className="w-full py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2">
                <Navigation size={14} /> Ambil Lokasi Saya Saat Ini
              </button>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Radius (Meter)</label>
                <input required type="number" className="w-full border rounded-lg p-2"
                  value={formData.radius_meter} onChange={e => setFormData({...formData, radius_meter: e.target.value})} />
                <p className="text-xs text-gray-400 mt-1">Jarak toleransi GPS (Standar: 50-100m)</p>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition flex justify-center gap-2">
                <Save size={18} /> Simpan Data
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}