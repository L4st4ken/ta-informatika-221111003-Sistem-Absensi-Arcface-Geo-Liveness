'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, ArrowLeft, X } from 'lucide-react'; // Hapus Calendar, User, MapPin yang tidak terpakai

export default function ScheduleManagement() {
  const router = useRouter();
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);     
  const [branches, setBranches] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    user_id: '',
    branch_id: '',
    tanggal: '',
    jam_mulai: '08:00',
    jam_selesai: '17:00'
  });

  // 1. Fetch Data Awal
  const initData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/'); return; }
      
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [resSched, resUsers, resBranches] = await Promise.all([
        axios.get('http://127.0.0.1:5000/schedule/', config),
        axios.get('http://127.0.0.1:5000/admin/users', config),
        axios.get('http://127.0.0.1:5000/admin/branches', config)
      ]);

      setSchedules(resSched.data);
      setUsers(resUsers.data.filter(u => u.role === 'supervisor')); 
      setBranches(resBranches.data);
      setLoading(false);
    } catch (err) {
      console.error(err); // FIX: Gunakan err agar tidak dianggap unused
    }
  };

  useEffect(() => { 
    initData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array kosong + disable lint agar jalan 1x saja

  // 2. Submit Jadwal
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://127.0.0.1:5000/schedule/', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Jadwal berhasil dibuat!");
      setShowModal(false);
      initData(); 
    } catch (err) {
      alert("Gagal membuat jadwal: " + (err.response?.data?.error || err.message));
    }
  };

  // 3. Delete Jadwal
  const handleDelete = async (id) => {
    if(!confirm("Hapus jadwal ini?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://127.0.0.1:5000/schedule/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      initData();
    } catch (err) {
      console.error(err); // Log error
      alert("Gagal menghapus");
    }
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
            <h1 className="text-xl font-bold text-gray-800">Manajemen Jadwal Dinas</h1>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            <Plus size={18} /> Buat Jadwal
          </button>
        </div>

        {/* List Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium uppercase">
              <tr>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Nama Supervisor</th>
                <th className="p-4">Lokasi Dinas</th>
                <th className="p-4">Jam Kerja</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan="5" className="p-6 text-center">Loading...</td></tr> : 
               schedules.map((s) => (
                <tr key={s.schedule_id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono">{s.tanggal}</td>
                  <td className="p-4 font-bold">{s.nama_karyawan}</td>
                  <td className="p-4">{s.nama_cabang}</td>
                  <td className="p-4">{s.jam_mulai} - {s.jam_selesai}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDelete(s.schedule_id)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 animate-bounce-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Buat Jadwal Baru</h3>
              <button onClick={() => setShowModal(false)}><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Select User */}
              <div>
                <label className="block text-sm font-bold mb-1">Supervisor</label>
                <select required className="w-full border rounded-lg p-2"
                  value={formData.user_id} onChange={e => setFormData({...formData, user_id: e.target.value})}>
                  <option value="">-- Pilih Supervisor --</option>
                  {users.map(u => <option key={u.user_id} value={u.user_id}>{u.nama_lengkap}</option>)}
                </select>
              </div>

              {/* Select Branch */}
              <div>
                <label className="block text-sm font-bold mb-1">Lokasi Dinas</label>
                <select required className="w-full border rounded-lg p-2"
                  value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})}>
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.nama_cabang}</option>)}
                </select>
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-sm font-bold mb-1">Tanggal</label>
                <input required type="date" className="w-full border rounded-lg p-2"
                  value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-bold mb-1">Mulai</label>
                   <input type="time" className="w-full border rounded-lg p-2"
                     value={formData.jam_mulai} onChange={e => setFormData({...formData, jam_mulai: e.target.value})} />
                </div>
                <div>
                   <label className="block text-sm font-bold mb-1">Selesai</label>
                   <input type="time" className="w-full border rounded-lg p-2"
                     value={formData.jam_selesai} onChange={e => setFormData({...formData, jam_selesai: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700">Simpan Jadwal</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}