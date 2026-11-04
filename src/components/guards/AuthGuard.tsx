import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert, LogOut, UserX } from 'lucide-react';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kuk-surface-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-kuk-maroon border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-gray-600">Memuat sesi KUK...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 1. Blokir akses jika pengguna belum memiliki record profil di database
  if (!profile) {
    return (
      <div className="min-h-screen bg-kuk-surface-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <UserX className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Profil Belum Terdaftar</h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Akun autentikasi Anda (<strong>{user.email}</strong>) belum terhubung dengan data profil
            pegawai KUK pada sistem database.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-800 text-left">
            Silakan hubungi HRD atau Administrator IT Pusat untuk inisialisasi profil dan penetapan
            unit kerja sebelum dapat mengakses aplikasi.
          </div>

          <button
            onClick={() => signOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-kuk-maroon hover:bg-kuk-maroon-dark text-white font-medium text-sm transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Sesi
          </button>

          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
            KUK Access Security & Isolation
          </div>
        </div>
      </div>
    );
  }

  // 2. Blokir akses jika akun berstatus tidak aktif (is_active = false)
  if (profile.is_active === false) {
    return (
      <div className="min-h-screen bg-kuk-surface-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 bg-red-100 text-kuk-maroon rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Akun Dinonaktifkan</h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Akun Anda (<strong>{profile.email}</strong>) saat ini dinonaktifkan oleh administrator.
            Akses ke seluruh modul dan data operasional KUK ditangguhkan.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-800 text-left">
            Silakan hubungi HRD atau Administrator IT KUK Pusat untuk klarifikasi atau pengaktifan
            kembali status keanggotaan Anda.
          </div>

          <button
            onClick={() => signOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-kuk-maroon hover:bg-kuk-maroon-dark text-white font-medium text-sm transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Sesi
          </button>

          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400">
            KUK Access Security & Isolation
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
