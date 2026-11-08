import React, { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import { isUatDemoAvailable, DEMO_IDENTITIES, DemoIdentityKey } from '@/services/demoAuth';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen bg-kuk-surface-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-kuk-maroon mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Halaman Utama</span>
        </Link>

        <div className="w-12 h-12 rounded-2xl bg-kuk-maroon text-white font-extrabold text-2xl flex items-center justify-center mx-auto shadow-md">
          K
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-gray-900">
          Masuk ke Portal Staf
        </h2>
        <p className="mt-1 text-center text-xs text-gray-500">
          KUK Management System · TB KUK La Tansa & KUK Palen
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Email Terdaftar
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staf@kuk.co.id"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kuk-maroon focus:border-kuk-maroon"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kuk-maroon focus:border-kuk-maroon"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-kuk-maroon hover:bg-kuk-maroon-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-kuk-maroon disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Memverifikasi...</span>
                </div>
              ) : (
                'Masuk ke Sistem'
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <span className="text-xs text-gray-500">
              Lupa password? Hubungi Administrator / HRD Unit Anda.
            </span>
          </div>
        </div>

        {/* Panel Akses Cepat Demo UAT (Hanya Aktif di Mode Dev Lokal dengan VITE_ENABLE_UAT_DEMO=true) */}
        {isUatDemoAvailable() && (
          <div className="mt-6 bg-amber-50/90 border border-amber-200/90 rounded-2xl p-5 shadow-xs animate-in fade-in">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300">
                  DEMO / UAT
                </span>
                <span className="text-xs font-bold text-amber-950">
                  Akses Cepat Pengujian Lokal
                </span>
              </div>
              <span className="text-[10px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full font-medium">
                Offline Mode
              </span>
            </div>

            <p className="text-[11px] text-amber-800 mb-4 leading-relaxed">
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
                    className="p-2.5 text-left rounded-xl bg-white border border-amber-200 hover:border-kuk-maroon hover:shadow-xs transition-all flex flex-col justify-between group"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-gray-900 group-hover:text-kuk-maroon">
                        {item.label}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
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

