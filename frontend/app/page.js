'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { KeyRound, Mail, LogIn, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMsg('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      // Sesuaikan URL ini dengan port backend Flask Anda (default localhost:5000)
      const API_URL = process.env.NEXT_PUBLIC_API_URL; 
      // Jika pakai Ngrok: 'https://nondeliberately-subordinal-maximina.ngrok-free.dev/auth/login'
      
      const res = await axios.post(`${API_URL}/auth/login`, formData, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (res.data.access_token) {
        // 1. Simpan Token & Data Penting ke Local Storage
        localStorage.setItem('access_token', res.data.access_token);
        localStorage.setItem('user_role', res.data.user.role);
        // KUNCI PENTING: Simpan flag fleksibel untuk bypass GPS di halaman Kamera!
        localStorage.setItem('is_dynamic', res.data.user.is_dynamic);
        
        // 2. Routing Berdasarkan Role yang Sederhana (admin vs karyawan)
        if (res.data.user.role === 'admin') {
          router.push('/admin/dashboard'); 
        } else {
          router.push('/dashboard'); // /dashboard adalah milik (user)
        }
      }
    } catch (err) {
      console.error("Login Error:", err);
      const errorText = err.response?.data?.error || err.response?.data?.msg || 'Gagal tersambung ke server.';
      setErrorMsg(errorText);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-blue-600 to-gray-50 z-0"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 z-10 relative">
        
        <div className="text-center mb-10 mt-4">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3 shadow-sm border border-blue-200">
            <LogIn size={40} className="-rotate-3" />
          </div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Selamat Datang</h1>
          <p className="text-gray-500 text-sm font-medium mt-2">Sistem Presensi AI & Geofencing</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm text-center border border-red-200 font-bold animate-in fade-in slide-in-from-top-2">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email Akses</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input
                type="email"
                name="email"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition font-medium text-gray-800"
                value={formData.email}
                onChange={handleChange}
                placeholder="nama@perusahaan.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Kata Sandi</label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-3.5 text-gray-400" size={20} />
              <input
                type="password"
                name="password"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition font-medium text-gray-800"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </div>
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 group active:scale-95"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Memproses...
                </div>
              ) : (
                <>Masuk ke Sistem <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </div>
        </form>

        {/* Info Text Menggantikan Link Register */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 font-medium">
            Skripsi TA Alvin Ricardo - 221111003.
          </p>
        </div>

      </div>
    </div>
  );
}