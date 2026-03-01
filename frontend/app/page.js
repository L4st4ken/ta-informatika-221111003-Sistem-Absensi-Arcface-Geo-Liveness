'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { KeyRound, Mail, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('https://nondeliberately-subordinal-maximina.ngrok-free.dev/auth/login', {
        email,
        password,
      });

      if (res.data.access_token) {
        // Simpan Token & Data User
        localStorage.setItem('token', res.data.access_token);
        
        // PENTING: Ambil Role dari response backend
        const userRole = res.data.user.role; 

        // LOGIKA REDIRECT BERDASARKAN ROLE
        if (userRole === 'admin') {
          router.push('/admin/dashboard'); // Ke Dashboard Admin
        } else {
          router.push('/dashboard'); // Ke Dashboard Karyawan/Supervisor
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login Gagal. Cek email/password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Absensi ArcFace</h1>
          <p className="text-gray-500 text-sm mt-1">Masuk ke akun Anda</p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@kantor.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg disabled:opacity-70"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">Belum punya akun?</p>
          <Link href="/register" className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline mt-1">
            <UserPlus size={16} /> Daftar Karyawan Baru
          </Link>
        </div>
      </div>
    </div>
  );
}