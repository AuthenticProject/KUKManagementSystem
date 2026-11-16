import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, AlertCircle, ArrowLeft, Eye, EyeOff, UserCheck } from 'lucide-react';
import { userAccountStore, StoredStaffUser } from '@/services/userAccountStore';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [staffUsers, setStaffUsers] = useState<StoredStaffUser[]>([]);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginAsStaff } = useAuth();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    // Load staff users from store
    const users = userAccountStore.getUsers();
    setStaffUsers(users);
  }, []);

  // Jika sudah login, redirect
  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const inputUser = username.trim();
    const inputPass = password.trim();

    if (!inputUser) {
      setErrorMsg('Silakan pilih username akun terlebih dahulu.');
      setLoading(false);
      return;
    }

    if (!inputPass) {
      setErrorMsg('Kata sandi wajib diisi.');
      setLoading(false);
      return;
    }

    // 1. Prioritas: Cek akun staf resmi (KUK Bangunan & KUK Palen)
    const staffAuth = userAccountStore.authenticate(inputUser, inputPass);
    if (staffAuth.success && staffAuth.user) {
      loginAsStaff(staffAuth.user);
      navigate(from, { replace: true });
      setLoading(false);
      return;
    }

    // 2. Fallback: Supabase remote auth jika ada konfigurasi
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: inputUser,
        password: inputPass,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        navigate(from, { replace: true });
        return;
      }
    } catch (err: any) {
      console.warn('[Login Error]', err);
      if (staffAuth && !staffAuth.success) {
        setErrorMsg(staffAuth.message);
      } else {
        setErrorMsg(err.message || 'Login gagal. Periksa kembali akun dan kata sandi Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  const bangunanUsers = staffUsers.filter((u) => !u.toko || u.toko === 'bangunan');
  const palenUsers = staffUsers.filter((u) => u.toko === 'palen');

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Brand Top Banner Line */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#540000] via-[#FFCC00] to-[#540000]" />

      {/* Subtle Background Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] bg-repeat"
        style={{ backgroundImage: 'url(/brand/patterns/pattern-dark.png)' }}
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#540000] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Halaman Utama</span>
        </Link>

        {/* Official KUK Logo Lockup */}
        <div className="flex flex-col items-center justify-center text-center">
          <img
            src="/brand/logos/kul-horizontal.png"
            alt="KUK Logo"
            className="h-14 sm:h-16 w-auto object-contain select-none mb-3 drop-shadow-xs"
          />
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 font-display">
            Portal Login Staf Manajemen
          </h2>
          <p className="mt-1 text-xs text-gray-600 font-medium">
            KUK Management System · TB KUK La Tansa & KUK Palen
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white py-8 px-6 shadow-brand border border-[#E5E5E5] rounded-3xl sm:px-10 relative overflow-hidden">
          {/* Subtle gold accent line on top of card */}
          <div className="absolute top-0 inset-x-0 h-1 bg-[#FFCC00]" />

          {errorMsg && (
            <div
              id="loginErrorMsg"
              className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm animate-in fade-in"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#FF0000]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Username Selector Dropdown */}
            <div>
              <label
                htmlFor="selectUsername"
                className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
              >
                Username Akun
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <UserCheck className="w-4 h-4 text-[#540000]" />
                </div>
                <select
                  id="selectUsername"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="block w-full pl-10 pr-8 py-2.5 border border-[#E5E5E5] bg-gray-50/50 hover:bg-white rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all cursor-pointer"
                >
                  <option value="" disabled>
                    -- Pilih Username / Akun Staf --
                  </option>
                  {bangunanUsers.length > 0 && (
                    <optgroup label="🏢 TB KUK LA TANSA (KUK BANGUNAN)">
                      {bangunanUsers.map((u) => (
                        <option key={u.id} value={u.username}>
                          {u.namaLengkap} ({u.jabatan})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {palenUsers.length > 0 && (
                    <optgroup label="🏬 KUK PALEN">
                      {palenUsers.map((u) => (
                        <option key={u.id} value={u.username}>
                          {u.namaLengkap} ({u.jabatan})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Password Input (User Types Password) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="inputPassword"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider"
                >
                  Kata Sandi (Password)
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4 text-[#540000]" />
                </div>
                <input
                  id="inputPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ketik kata sandi Anda"
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-10 py-2.5 border border-[#E5E5E5] rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-sm font-bold text-white bg-[#540000] hover:bg-[#3B0000] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFCC00] disabled:opacity-60 transition-all select-none active:scale-[0.99]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi...</span>
                </div>
              ) : (
                'Masuk ke Sistem'
              )}
            </button>
          </form>

          <div className="mt-5 pt-3 border-t border-[#E5E5E5] text-center">
            <span className="text-[11px] text-gray-500">
              Semua nama, jabatan, dan kata sandi dapat diubah di menu <strong>Pengaturan Akun</strong>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
