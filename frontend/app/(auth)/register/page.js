'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Building, ArrowLeft } from 'lucide-react';
// Hapus import Link karena tidak dipakai, atau gunakan untuk tombol "Login" di bawah

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    email: '',
    password: '',
    role: 'karyawan',
    branch_id: '1'
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    try {
      // FIX 'res assigned but never used': Kita baca response dari backend
      const res = await axios.post('http://127.0.0.1:5000/auth/register', formData);
      
      // Gunakan pesan dari backend jika ada, atau default
      const successMessage = res.data.msg || 'Registrasi Berhasil! Silakan Login.';
      
      setMsg({ type: 'success', text: successMessage });
      
      // Redirect setelah 2 detik
      setTimeout(() => router.push('/'), 2000);
      
    } catch (err) {
      // Baca error message dari backend
      const errorText = err.response?.data?.error || err.response?.data?.msg || 'Gagal Mendaftar.';
      setMsg({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        
        <button onClick={() => router.back()} className="flex items-center text-gray-500 hover:text-gray-800 mb-6 transition">
          <ArrowLeft size={18} className="mr-1" /> Kembali
        </button>

        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Daftar Akun Baru</h1>

        {msg.text && (
          <div className={`p-3 rounded-lg mb-6 text-sm text-center ${msg.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Nama */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input name="nama_lengkap" type="text" required onChange={handleChange} 
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input name="email" type="email" required onChange={handleChange} 
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input name="password" type="password" required onChange={handleChange} 
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {/* Role & Cabang (Row) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
              <select name="role" onChange={handleChange} className="w-full p-2 border rounded-lg outline-none bg-white">
                <option value="karyawan">Karyawan</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID Cabang</label>
              <div className="relative">
                <Building className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input name="branch_id" type="number" defaultValue="1" onChange={handleChange} 
                  className="w-full pl-10 pr-2 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition mt-4">
            {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
          </button>
        </form>
      </div>
    </div>
  );
}