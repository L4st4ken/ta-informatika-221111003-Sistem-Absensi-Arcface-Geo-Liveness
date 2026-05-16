'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, ArrowLeft, X, Save, Clock, MapPin, CheckCircle, Briefcase, Calendar } from 'lucide-react'; 

export default function ScheduleManagement() {
  const router = useRouter();
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);     
  const [branches, setBranches] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    user_id: '',
    branch_id: '',
    tipe_jadwal: 'Reguler', // UPDATE 1: Default tipe jadwal
    tanggal: '',
    jam_mulai: '08:00',
    jam_selesai: '17:00'
  });

  const initData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/'); return; }
      
      const config = { headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } };

      const [resSched, resUsers, resBranches] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/schedule/`, config),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/admin/users`, config),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/admin/branches`, config)
      ]);

      setSchedules(resSched.data);
      // UPDATE 2: Tampilkan semua kecuali HRD, karena semua butuh jadwal (bukan hanya supervisor)
      setUsers(resUsers.data.filter(u => u.role !== 'admin_hrd')); 
      setBranches(resBranches.data);
      
      // Set default untuk modal
      if (resUsers.data.length > 0) setFormData(prev => ({ ...prev, user_id: resUsers.data[0].user_id }));
      if (resBranches.data.length > 0) setFormData(prev => ({ ...prev, branch_id: resBranches.data[0].branch_id }));
      
      setLoading(false);
    } catch (err) {
      console.error(err); 
      if (err.response?.status === 401 || err.response?.status === 403) router.push('/');
    }
  };

  useEffect(() => { 
    initData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      // Jika Dinas Luar, pastikan branch_id kosong agar backend tidak error
      const payload = { ...formData };
      if (payload.tipe_jadwal === 'Dinas Luar') payload.branch_id = null;

      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/schedule/`, payload, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      alert("Jadwal dinas berhasil dibuat!");
      setShowModal(false);
      initData(); 
    } catch (err) {
      alert("Gagal membuat jadwal: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Hapus jadwal ini? Karyawan akan kembali ke Shift Normal.")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/schedule/${id}`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      initData();
    } catch (err) {
      console.error(err); 
      alert("Gagal menghapus jadwal");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-800">Manajemen Penugasan (BKO/Dinas Luar)</h1>
              <p className="text-sm font-medium text-gray-500">Timpa shift normal karyawan untuk hari tertentu.</p>
            </div>
          </div>
          <button onClick={() => {
            setFormData(prev => ({...prev, tanggal: new Date().toISOString().split('T')[0]})); // Set tgl hari ini
            setShowModal(true);
          }} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200 active:scale-95 w-full md:w-auto">
            <Plus size={18} /> Buat Penugasan
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                <tr>
                  <th className="p-5">Tanggal</th>
                  <th className="p-5">Karyawan</th>
                  <th className="p-5">Tipe & Lokasi Penugasan</th>
                  <th className="p-5">Jam Penugasan</th>
                  <th className="p-5 text-center">Status</th>
                  <th className="p-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan="6" className="p-12 text-center text-gray-400 font-medium animate-pulse">Memuat Jadwal...</td></tr> : 
                 schedules.length > 0 ? schedules.map((s) => (
                <tr key={s.schedule_id} className="hover:bg-blue-50/50 transition">
                  <td className="p-5">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                      <Calendar size={16} className="text-blue-500" /> {s.tanggal}
                    </div>
                  </td>
                  <td className="p-5 font-bold text-gray-800">{s.nama_karyawan}</td>
                  <td className="p-5">
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${s.tipe_jadwal === 'Dinas Luar' ? 'text-indigo-600' : 'text-blue-600'}`}>{s.tipe_jadwal}</p>
                    <p className="text-gray-600 font-medium flex items-center gap-1.5">
                      <MapPin size={14} className={s.tipe_jadwal === 'Dinas Luar' ? 'text-indigo-400' : 'text-gray-400'} /> {s.nama_cabang}
                    </p>
                  </td>
                  <td className="p-5 font-mono font-medium text-gray-700 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400"/> {s.jam_mulai} - {s.jam_selesai}
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border text-green-600 bg-green-50 border-green-200">
                      Aktif
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="flex justify-center">
                      <button onClick={() => handleDelete(s.schedule_id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition" title="Batalkan Jadwal">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan="6" className="p-12 text-center text-gray-400 font-medium">Belum ada penugasan ekstra.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transform transition-all">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-xl text-gray-800">Buat Penugasan Baru</h3>
              <button onClick={() => setShowModal(false)} className="p-2 bg-white rounded-full border border-gray-200 hover:bg-red-50 hover:text-red-500 transition"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pilih Karyawan</label>
                <select required className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-sm font-bold text-gray-700"
                  value={formData.user_id} onChange={e => setFormData({...formData, user_id: e.target.value})}>
                  <option value="" disabled>-- Pilih Karyawan --</option>
                  {users.map(u => <option key={u.user_id} value={u.user_id}>{u.nama_lengkap} ({u.role.replace('_', ' ')})</option>)}
                </select>
              </div>

              {/* UPDATE 3: Pilihan Tipe Jadwal */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <label className="block text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Briefcase size={14}/> Tipe Penugasan
                </label>
                <select required className="w-full border border-indigo-200 bg-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-bold text-indigo-900"
                  value={formData.tipe_jadwal} onChange={e => setFormData({...formData, tipe_jadwal: e.target.value})}>
                  <option value="Reguler">Reguler (WFO Cabang Sendiri)</option>
                  <option value="BKO Cabang">BKO (Bantuan Kendali Operasi ke Cabang Lain)</option>
                  <option value="Dinas Luar">Dinas Luar / Keliling (Bypass Geofence GPS)</option>
                </select>
              </div>

              {/* Sembunyikan Input Cabang Jika Dinas Luar */}
              {formData.tipe_jadwal !== 'Dinas Luar' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lokasi Tujuan / BKO</label>
                  <select required={formData.tipe_jadwal !== 'Dinas Luar'} className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-sm font-bold text-gray-700"
                    value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})}>
                    <option value="" disabled>-- Pilih Cabang --</option>
                    {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.nama_cabang}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tanggal Berlakunya</label>
                <input required type="date" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-sm font-medium"
                  value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Jam Mulai</label>
                   <input required type="time" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-sm font-mono font-bold"
                     value={formData.jam_mulai} onChange={e => setFormData({...formData, jam_mulai: e.target.value})} />
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Jam Selesai</label>
                   <input required type="time" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-sm font-mono font-bold"
                     value={formData.jam_selesai} onChange={e => setFormData({...formData, jam_selesai: e.target.value})} />
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100">
                <button type="submit" className="w-full bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-blue-700 transition flex justify-center gap-2 items-center shadow-lg shadow-blue-200 active:scale-95">
                  <Save size={18} /> Simpan Penugasan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}