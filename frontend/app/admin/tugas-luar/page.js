'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Briefcase, ArrowLeft, Plus, Trash2, Calendar, X, Save } from 'lucide-react';

export default function TugasLuarPage() {
  const router = useRouter();
  const [tugasList, setTugasList] = useState([]);
  const [usersStatis, setUsersStatis] = useState([]); // Hanya simpan user yg statis
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    tanggal_mulai: '',
    tanggal_selesai: '',
    keterangan: ''
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return router.push('/');

      const headers = { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' };

      // Ambil data Tugas Luar dan daftar Karyawan secara paralel
      const [resTugas, resUsers] = await Promise.all([
        axios.get(`${API_URL}/admin/tugas-luar`, { headers }),
        axios.get(`${API_URL}/admin/users`, { headers })
      ]);

      setTugasList(resTugas.data);
      
      // Filter Cerdas: Hanya tampilkan karyawan yang statusnya Statis (!is_dynamic)
      const karyawanStatis = resUsers.data.filter(u => u.is_dynamic === false && u.role === 'karyawan');
      setUsersStatis(karyawanStatis);
      
      if (karyawanStatis.length > 0 && !formData.user_id) {
        setFormData(prev => ({ ...prev, user_id: karyawanStatis[0].user_id }));
      }

    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) router.push('/');
    } finally {
      setLoading(false);
    }
  }, [router, formData.user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/admin/tugas-luar`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert("Izin Dinas Luar berhasil diterbitkan!");
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Terjadi kesalahan saat menyimpan data.");
    }
  };

  const handleDelete = async (tugas_id) => {
    if (!confirm("Yakin ingin membatalkan/menghapus Izin Dinas Luar ini?")) return;
    try {
      const token = localStorage.getItem('access_token');
      await axios.delete(`${API_URL}/admin/tugas-luar/${tugas_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Gagal menghapus data");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-purple-50 text-purple-600 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-800">Manajemen Tugas Luar (TL)</h1>
              <p className="text-sm font-medium text-gray-500">Dispensasi Geofence khusus untuk Karyawan Statis.</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl hover:bg-purple-700 transition font-bold shadow-lg shadow-purple-200 active:scale-95 w-full md:w-auto justify-center">
            <Plus size={18} /> Terbitkan Izin TL
          </button>
        </div>

        {/* Tabel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                <tr>
                  <th className="p-5">Nama Karyawan</th>
                  <th className="p-5 text-center">Tanggal Mulai</th>
                  <th className="p-5 text-center">Tanggal Selesai</th>
                  <th className="p-5">Keterangan / Tujuan</th>
                  <th className="p-5 text-center">Status</th>
                  <th className="p-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="6" className="p-12 text-center font-medium text-gray-500">Memuat Data...</td></tr>
                ) : tugasList.length > 0 ? (
                  tugasList.map((tugas) => (
                    <tr key={tugas.tugas_id} className="hover:bg-purple-50/50 transition">
                      <td className="p-5 font-bold text-gray-800">{tugas.nama_karyawan}</td>
                      <td className="p-5 text-center font-mono text-gray-600"><Calendar size={14} className="inline mr-1 text-gray-400"/>{tugas.tanggal_mulai}</td>
                      <td className="p-5 text-center font-mono text-gray-600"><Calendar size={14} className="inline mr-1 text-gray-400"/>{tugas.tanggal_selesai}</td>
                      <td className="p-5 text-gray-600 italic text-xs">{tugas.keterangan || "-"}</td>
                      <td className="p-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          tugas.status === 'Sedang Berjalan' ? 'bg-green-100 text-green-700' :
                          tugas.status === 'Akan Datang' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {tugas.status}
                        </span>
                      </td>
                      <td className="p-5 text-center">
                        <button onClick={() => handleDelete(tugas.tugas_id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition" title="Batalkan Tugas">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="6" className="p-12 text-center text-gray-400 font-medium">Tidak ada karyawan yang sedang/akan tugas luar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL FORM TUGAS LUAR */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-xl text-gray-800 flex items-center gap-2"><Briefcase className="text-purple-600"/> Terbitkan Izin</h3>
              <button onClick={() => setShowModal(false)} className="p-2 bg-white rounded-full border border-gray-200 hover:bg-red-50 hover:text-red-500 transition">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pilih Karyawan (Statis)</label>
                <select 
                  required 
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 text-black text-sm font-bold"
                  value={formData.user_id} 
                  onChange={e => setFormData({...formData, user_id: e.target.value})}
                >
                  <option value="" disabled>-- Pilih Karyawan --</option>
                  {usersStatis.map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.nama_lengkap}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">*Hanya menampilkan karyawan yang terikat Geofence.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mulai Tgl</label>
                  <input required type="date" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 text-black text-sm font-medium"
                    value={formData.tanggal_mulai} onChange={e => setFormData({...formData, tanggal_mulai: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Selesai Tgl</label>
                  <input required type="date" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 text-black text-sm font-medium"
                    value={formData.tanggal_selesai} onChange={e => setFormData({...formData, tanggal_selesai: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Keterangan / Tujuan</label>
                <textarea required rows="3" placeholder="Contoh: Menghadiri rapat koordinasi di Surabaya" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 text-black text-sm font-medium resize-none"
                  value={formData.keterangan} onChange={e => setFormData({...formData, keterangan: e.target.value})} />
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-purple-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-purple-700 transition flex justify-center gap-2 items-center shadow-lg shadow-purple-200 active:scale-95">
                  <Save size={18} /> Simpan Izin Dinas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}