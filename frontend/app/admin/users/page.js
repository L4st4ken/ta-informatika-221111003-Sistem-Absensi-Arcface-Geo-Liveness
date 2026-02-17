'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Trash2, Edit, Plus, Search, ArrowLeft, Save, X } from 'lucide-react';

export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State untuk Modal
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    nama_lengkap: '',
    email: '',
    password: '',
    role: 'karyawan',
    branch_id: 1,
    shift_id: 1
  });

  // --- 1. FETCH DATA (Fungsi Biasa) ---
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const res = await axios.get('http://127.0.0.1:5000/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      // alert("Gagal memuat data user");
    }
  };

  // --- USE EFFECT (Jalan Sekali saat Mount) ---
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  // ^ Kode di atas menyuruh React untuk menjalankan ini 1x saja saat halaman dibuka.

  // --- 2. HANDLER CRUD ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    try {
      if (isEditMode) {
        // Edit User
        await axios.put(`http://127.0.0.1:5000/admin/users/${formData.user_id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert("User berhasil diupdate!");
      } else {
        // Create User
        await axios.post('http://127.0.0.1:5000/admin/users', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert("User berhasil dibuat!");
      }
      
      setShowModal(false);
      fetchUsers(); // Refresh tabel manual setelah submit
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Terjadi kesalahan");
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Yakin ingin menghapus user ini?")) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://127.0.0.1:5000/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers(); // Refresh tabel
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus user");
    }
  };

  // --- 3. HELPER MODAL ---
  const openAddModal = () => {
    setFormData({ user_id: '', nama_lengkap: '', email: '', password: '', role: 'karyawan', branch_id: 1, shift_id: 1 });
    setIsEditMode(false);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setFormData({
      user_id: user.user_id,
      nama_lengkap: user.nama_lengkap,
      email: user.email,
      password: '', 
      role: user.role,
      branch_id: user.branch_id || 1, 
      shift_id: user.shift_id || 1
    });
    setIsEditMode(true);
    setShowModal(true);
  };

  // Filter Search
  const filteredUsers = users.filter(u => 
    u.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Page */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-gray-800">Manajemen Karyawan</h1>
          </div>
          <button onClick={openAddModal} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            <Plus size={18} /> Tambah User
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Cari nama atau email..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium uppercase">
              <tr>
                <th className="p-4">Nama</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Cabang</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="p-6 text-center">Loading...</td></tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-bold text-gray-800">{user.nama_lengkap}</td>
                    <td className="p-4 text-gray-600">{user.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold capitalize ${
                        user.role === 'admin' ? 'bg-red-100 text-red-700' : 
                        user.role === 'supervisor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-4">{user.branch}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(user.user_id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="5" className="p-6 text-center text-gray-400">Tidak ada data user.</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* --- MODAL FORM --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-bounce-in">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">{isEditMode ? 'Edit User' : 'Tambah User Baru'}</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-500 hover:text-red-500" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nama Lengkap</label>
                <input required type="text" className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.nama_lengkap} onChange={e => setFormData({...formData, nama_lengkap: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input required type="email" className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>

              {!isEditMode && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                  <input required type="password" className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                  <select className="w-full border rounded-lg p-2 bg-white"
                    value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="karyawan">Karyawan</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">ID Cabang</label>
                  <input required type="number" className="w-full border rounded-lg p-2"
                    value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} />
                </div>
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