'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Building, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    email: '',
    password: '',
    role: 'kurir', // UPDATE 1: Default role diubah ke kurir
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
      // GANTI URL NGROK INI JIKA BERUBAH
      const res = await axios.post('https://nondeliberately-subordinal-maximina.ngrok-free.dev/auth/register', formData);
      
      const successMessage = res.data.msg || 'Registrasi Berhasil! Silakan Login.';
      setMsg({ type: 'success', text: successMessage });
      
      setTimeout(() => router.push('/'), 2000);
      
    } catch (err) {
      const errorText = err.response?.data?.error || err.response?.data?.msg || 'Gagal Mendaftar.';
      setMsg({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        
        <button onClick={() => router.back()} className="flex items-center text-gray-400 hover:text-gray-800 mb-8 transition font-medium text-sm">
          <ArrowLeft size={18} className="mr-1" /> Kembali ke Login
        </button>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Daftar Akun Baru</h1>
          <p className="text-gray-500 text-sm mt-1">Lengkapi data diri Anda di bawah ini</p>
        </div>

        {msg.text && (
          <div className={`p-4 rounded-xl mb-6 text-sm text-center font-bold border ${msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          {/* Nama */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 text-gray-400" size={18} />
              <input name="nama_lengkap" type="text" required onChange={handleChange} placeholder="Misal: Budi Santoso"
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-gray-400" size={18} />
              <input name="email" type="email" required onChange={handleChange} placeholder="budi@ekspedisi.com"
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-gray-400" size={18} />
              <input name="password" type="password" required onChange={handleChange} placeholder="Minimal 6 karakter"
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition" />
            </div>
          </div>

          {/* Role & Cabang (Row) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Jabatan</label>
              {/* UPDATE 2: Dropdown disesuaikan dengan Enum Database Baru */}
              <select name="role" onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm">
                <option value="kurir">Kurir Lapangan</option>
                <option value="staf_gudang">Staf Gudang</option>
                <option value="koordinator_area">Koordinator Area</option>
                <option value="admin_hrd">Admin HRD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">ID Cabang</label>
              <div className="relative">
                <Building className="absolute left-3 top-3 text-gray-400" size={18} />
                <input name="branch_id" type="number" defaultValue="1" onChange={handleChange} 
                  className="w-full pl-9 pr-2 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm" />
              </div>
            </div>
          </div>
          
          <div className="pt-2">
            <button type="submit" disabled={loading} 
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? 'Memproses Data...' : 'Daftar Sekarang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}