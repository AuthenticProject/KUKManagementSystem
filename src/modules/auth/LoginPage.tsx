import React, { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Mail, AlertCircle, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { isUatDemoAvailable, DEMO_IDENTITIES, DemoIdentityKey } from '@/services/demoAuth';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginAsDemo } = useAuth();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  // Jika sudah login, redirect
  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Di mode demo lokal, dukung login otomatis jika email cocok dengan akun demo
    if (isUatDemoAvailable()) {
      const matchedKey = (Object.keys(DEMO_IDENTITIES) as DemoIdentityKey[]).find(
        (key) => DEMO_IDENTITIES[key].profile.email.toLowerCase() === email.trim().toLowerCase()
      );
      if (matchedKey) {
        loginAsDemo(matchedKey);
        navigate(from, { replace: true });
        setLoading(false);
        return;
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      console.error('[Login Error]', err);
      setErrorMsg(err.message || 'Login gagal. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

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
            Portal Manajemen Staf
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
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#FF0000]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Email Terdaftar
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staf@kuk.co.id"
                  className="block w-full pl-10 pr-3.5 py-2.5 border border-[#E5E5E5] rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-[#996414] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

          <div className="mt-6 pt-4 border-t border-[#E5E5E5] text-center">
            <span className="text-xs text-gray-500">
              Lupa password? Hubungi Administrator / HRD Unit Anda.
            </span>
          </div>
        </div>

        {/* Panel Akses Cepat Demo UAT (Hanya Aktif di Mode Dev Lokal dengan VITE_ENABLE_UAT_DEMO=true) */}
        {isUatDemoAvailable() && (
          <div className="mt-6 bg-white border border-[#FFCC00] rounded-3xl p-5 shadow-brand relative overflow-hidden animate-in fade-in">
            <div className="absolute top-0 inset-x-0 h-1 bg-[#FFCC00]" />

            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#540000] text-[#FFCC00]">
                  LOCAL DEMO / UAT
                </span>
                <span className="text-xs font-bold text-gray-900">
                  Akses Cepat Pengujian Lokal
                </span>
              </div>
              <span className="text-[10px] text-[#996414] bg-[#FFF9D6] px-2 py-0.5 rounded-full font-bold border border-[#FFE066] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Offline Mode
              </span>
            </div>

            <p className="text-[11px] text-gray-600 mb-4 leading-relaxed">
              Klik salah satu peran di bawah ini untuk menguji hak akses dan alur kerja bisnis secara offline tanpa koneksi ke database production.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(DEMO_IDENTITIES) as DemoIdentityKey[]).map((key) => {
                const item = DEMO_IDENTITIES[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      loginAsDemo(key);
                      navigate('/dashboard', { replace: true });
                    }}
                    className="p-3 text-left rounded-2xl bg-[#F8F9FA] border border-[#E5E5E5] hover:border-[#540000] hover:bg-white hover:shadow-xs transition-all flex flex-col justify-between group active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-gray-900 group-hover:text-[#540000] transition-colors">
                        {item.label}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                        {item.role}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 leading-tight">
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
