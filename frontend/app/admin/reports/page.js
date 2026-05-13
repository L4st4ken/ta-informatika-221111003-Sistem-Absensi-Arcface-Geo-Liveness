'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download, Search, Filter, Plus, X, ClipboardEdit, MapPin } from 'lucide-react';

export default function LaporanPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // State Filter & Search
  const [filterType, setFilterType] = useState('monthly'); // 'daily' atau 'monthly'
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [filterBranch, setFilterBranch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // State Modal Input Manual (Sakit/Izin)
  const [showModal, setShowModal] = useState(false);
  const [manualData, setManualData] = useState({
    user_id: '',
    tanggal: new Date().toISOString().split('T')[0],
    status: 'Sakit',
    keterangan: ''
  });

  const API_URL = 'https://nondeliberately-subordinal-maximina.ngrok-free.dev';

  // 1. Fetch Data Master (Branches & Users)
  const fetchMasterData = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return router.push('/');
      
      const config = { headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } };
      
      const [resBranches, resUsers] = await Promise.all([
        axios.get(`${API_URL}/admin/branches`, config),
        axios.get(`${API_URL}/admin/users`, config)
      ]);
      
      setBranches(resBranches.data);
      // Filter agar HRD tidak menginput sakit/izin untuk sesama Admin
      setUsers(resUsers.data.filter(u => u.role !== 'admin'));
    } catch (e) { 
      console.error(e); 
      if (e.response?.status === 401) router.push('/');
    }
  }, [router]);

  // 2. Fetch Report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      let url = `${API_URL}/admin/reports?`;
      if (filterType === 'daily') {
        url += `date=${filterDate}`;
      } else {
        const year = filterMonth.split('-')[0];
        const month = parseInt(filterMonth.split('-')[1], 10);
        url += `month=${month}&year=${year}`;
      }
      if (filterBranch) url += `&branch_id=${filterBranch}`;

      const res = await axios.get(url, { 
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' } 
      });
      setReports(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterDate, filterMonth, filterBranch]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // 3. Download Excel
  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('access_token');
      
      let url = `${API_URL}/admin/export/attendance?`;
      let fileName = '';

      if (filterType === 'daily') {
        url += `date=${filterDate}`;
        fileName = filterBranch ? `Rekap_Cabang_${filterDate}.xlsx` : `Rekap_Harian_${filterDate}.xlsx`;
      } else {
        const year = filterMonth.split('-')[0];
        const month = parseInt(filterMonth.split('-')[1], 10);
        url += `month=${month}&year=${year}`;
        fileName = filterBranch ? `Rekap_Cabang_${year}_${month}.xlsx` : `Rekap_Bulanan_${year}_${month}.xlsx`;
      }
      if (filterBranch) url += `&branch_id=${filterBranch}`; 

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        responseType: 'blob' 
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName); 
      document.body.appendChild(link);
      link.click(); 
      link.remove(); 
      
    } catch (err) {
      alert("Gagal mengunduh file Excel. Pastikan data laporan tidak kosong.");
    }
  };

  // 4. Handler Input Manual (Sakit/Izin)
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualData.user_id) return alert("Pilih karyawan terlebih dahulu!");

    try {
      const token = localStorage.getItem('access_token');
      await axios.post(`${API_URL}/admin/manual-attendance`, manualData, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' }
      });
      alert(`Status ${manualData.status} berhasil dicatat!`);
      setShowModal(false);
      setManualData({ ...manualData, keterangan: '' }); 
      fetchReport(); 
    } catch (err) {
      alert(err.response?.data?.error || "Gagal menyimpan data manual.");
    }
  };

  const filteredReports = reports.filter(r => 
    r.nama_karyawan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.status_kehadiran?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-800">Laporan Kehadiran</h1>
              <p className="text-sm font-medium text-gray-500">Rekapitulasi absensi, cetak, dan kelola izin.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button onClick={() => setShowModal(true)} className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl hover:bg-indigo-100 transition font-bold text-sm border border-indigo-200 flex-1 md:flex-none">
              <ClipboardEdit size={16} /> Input Sakit/Izin
            </button>
            <button onClick={() => window.print()} className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition font-bold text-sm flex-1 md:flex-none shadow-sm">
              <Printer size={16} /> Cetak PDF
            </button>
            <button onClick={handleExportExcel} className="flex items-center justify-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl hover:bg-green-700 transition font-bold text-sm shadow-lg shadow-green-200 active:scale-95 flex-1 md:flex-none">
              <Download size={16} /> Export Excel
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Filters */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-4 print:hidden">
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-3 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama karyawan..." 
              className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium text-gray-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
            
            {/* TOGGLE HARIAN VS BULANAN */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setFilterType('daily')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${filterType === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Harian
              </button>
              <button 
                onClick={() => setFilterType('monthly')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${filterType === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Bulanan
              </button>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1 rounded-xl flex-1 md:flex-none">
              <Filter size={16} className="text-gray-400" />
              {filterType === 'daily' ? (
                <input 
                  type="date" 
                  className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 cursor-pointer w-full"
                  value={filterDate} 
                  onChange={e => setFilterDate(e.target.value)} 
                />
              ) : (
                <input 
                  type="month" 
                  className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 cursor-pointer w-full"
                  value={filterMonth} 
                  onChange={e => setFilterMonth(e.target.value)} 
                />
              )}
            </div>
            
            <select className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none flex-1 md:flex-none cursor-pointer"
              value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">-- Semua Cabang --</option>
              {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.nama_cabang}</option>)}
            </select>
          </div>
        </div>

        {/* Table Report */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 print:shadow-none print:border-none">
          <div className="mb-4 hidden print:block text-center pt-8">
            <h2 className="text-2xl font-bold uppercase">Laporan Absensi Karyawan</h2>
            <p className="text-gray-500 mt-1">Periode: {filterMonth} | Cabang: {filterBranch ? branches.find(b => b.branch_id.toString() === filterBranch)?.nama_cabang : 'Semua Cabang'}</p>
          </div>

          <div className="overflow-x-auto max-h-[600px] print:overflow-visible print:max-h-none">
            <table className="w-full text-sm text-left relative">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-sm border-b border-gray-100">
                <tr>
                  <th className="p-5">Tanggal</th>
                  <th className="p-5">Profil Karyawan</th>
                  <th className="p-5">Lokasi Tugas</th>
                  <th className="p-5 text-center">Masuk</th>
                  <th className="p-5 text-center">Pulang</th>
                  <th className="p-5 text-center">Status Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="6" className="p-12 text-center text-gray-400 font-bold animate-pulse">Menarik Data Rekapitulasi...</td></tr>
                ) : filteredReports.length > 0 ? (
                  filteredReports.map((r, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition">
                      <td className="p-5 font-mono text-gray-600 font-medium">{r.tanggal}</td>
                      <td className="p-5">
                        <p className="font-bold text-gray-800 text-sm">{r.nama_karyawan}</p>
                        
                        <div className="mt-1.5 space-y-0.5">
                          {/* NIK Karyawan */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest w-12">NIK</span>
                            <span className="text-[11px] font-mono font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                              {r.nik || '-'}
                            </span>
                          </div>
                          
                          {/* Jabatan & Mode Mobilitas */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest w-12">Status</span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                              {r.jabatan} • Mode {r.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 font-medium text-gray-700">{r.cabang}</td>
                      {/* KOLOM JAM MASUK */}
                      <td className="p-5 text-center">
                        {r.jam_masuk ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono font-bold text-blue-600">{r.jam_masuk}</span>
                            {r.lat_in && r.lng_in && (
                            <a 
                              href={`https://www.google.com/maps?q=${r.lat_in},${r.lng_in}`}
                              target="_blank" rel="noopener noreferrer"
                              title="Lihat Lokasi Absen Pagi"
                              className="text-gray-400 hover:text-blue-500 transition"
                            >
                              <MapPin size={14} />
                            </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* KOLOM JAM PULANG */}
                      <td className="p-5 text-center">
                        {r.jam_pulang ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-mono font-bold text-orange-600">{r.jam_pulang}</span>
                            {r.lat_out && r.lng_out && (
                            <a 
                              href={`https://www.google.com/maps?q=${r.lat_in},${r.lng_in}`}
                              target="_blank" rel="noopener noreferrer"
                              title="Lihat Lokasi Absen Pagi"
                              className="text-gray-400 hover:text-blue-500 transition"
                            >
                              <MapPin size={14} />
                            </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-5 text-center flex flex-col items-center justify-center">
                        <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                          r.status_kehadiran === 'Hadir' || r.status_kehadiran === 'Tepat Waktu'
                            ? 'bg-green-50 text-green-700 border-green-200' : 
                          r.status_kehadiran === 'Sakit'
                            ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          r.status_kehadiran === 'Izin'
                            ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          r.status_kehadiran === 'Cuti'
                            ? 'bg-teal-50 text-teal-700 border-teal-200' :
                          r.status_kehadiran === 'Belum Lengkap'
                            ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 
                          'bg-red-50 text-red-700 border-red-200' // Alpha/Kosong
                        }`}>
                          {r.status_kehadiran || 'Alpha'}
                        </span>

                        {/* TAMBAHAN BARU: Menampilkan Keterangan/Catatan HRD */}
                        {r.keterangan_hrd && (
                          <div 
                            className="mt-2 flex items-center gap-1 text-[9px] text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 max-w-[120px] cursor-help"
                            title={r.keterangan_hrd} // Tooltip bawaan browser jika teks kepanjangan
                          >
                            <ClipboardEdit size={10} className="flex-shrink-0 text-indigo-400" />
                            <span className="truncate italic">&quot;{r.keterangan_hrd}&quot;</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-16 text-center">
                      <div className="text-gray-300 mb-3">
                        <Filter size={48} className="mx-auto" />
                      </div>
                      <p className="text-gray-600 font-bold text-lg">Laporan Kosong</p>
                      <p className="text-sm text-gray-400 mt-1">Ubah filter bulan atau cabang untuk mencari data.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL INPUT MANUAL (SAKIT/IZIN) --- */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 print:hidden">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-xl text-gray-800">Input Manual HRD</h3>
              <button onClick={() => setShowModal(false)} className="p-2 bg-white rounded-full border border-gray-200 hover:bg-red-50 hover:text-red-500 transition"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleManualSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nama Karyawan</label>
                <select required className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-bold text-gray-800"
                  value={manualData.user_id} onChange={e => setManualData({...manualData, user_id: e.target.value})}>
                  <option value="" disabled>-- Pilih Karyawan --</option>
                  {users.map(u => <option key={u.user_id} value={u.user_id}>{u.nama_lengkap}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tanggal</label>
                  <input required type="date" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-medium text-black"
                    value={manualData.tanggal} onChange={e => setManualData({...manualData, tanggal: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                  <select required className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-bold text-gray-800"
                    value={manualData.status} onChange={e => setManualData({...manualData, status: e.target.value})}>
                    <option value="Sakit">Sakit</option>
                    <option value="Izin">Izin Tertulis</option>
                    <option value="Cuti">Cuti</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Keterangan / Catatan HRD (Opsional)</label>
                <textarea rows="3" placeholder="Misal: Surat keterangan RS terlampir." className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-medium resize-none text-black"
                  value={manualData.keterangan} onChange={e => setManualData({...manualData, keterangan: e.target.value})}></textarea>
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100">
                <button type="submit" className="w-full bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition flex justify-center gap-2 items-center shadow-lg shadow-indigo-200 active:scale-95">
                  <Plus size={18} /> Simpan Data Kehadiran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}