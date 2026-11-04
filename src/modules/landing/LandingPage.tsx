import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, Users, Lock, ChevronRight, Scissors, Calendar } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-kuk-surface-bg flex flex-col justify-between">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-kuk-maroon flex items-center justify-center text-white font-extrabold text-xl shadow-md">
            K
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900 leading-tight">KUK Management System</h1>
            <p className="text-xs text-gray-500 font-medium">TB KUK La Tansa · KUK Palen</p>
          </div>
        </div>
        <Link
          to="/login"
          className="text-sm font-semibold text-kuk-maroon hover:text-kuk-maroon-dark bg-kuk-maroon-50 hover:bg-kuk-maroon-100/60 px-4 py-2 rounded-lg transition-colors border border-kuk-maroon-200"
        >
          Portal Staf
        </Link>
      </header>

      {/* Hero Content */}
      <main className="max-w-5xl mx-auto px-4 py-12 sm:py-16 w-full flex-1 flex flex-col justify-center">
        <div className="text-center mb-12">
          <span className="text-xs font-bold tracking-wider text-kuk-maroon uppercase bg-kuk-maroon-50 border border-kuk-maroon-100 px-3 py-1 rounded-full">
            Portal Layanan Terpadu KUK
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-4 tracking-tight">
            Pusat Operasional, Karyawan & Armada
          </h2>
          <p className="text-gray-600 mt-2 max-w-xl mx-auto text-sm sm:text-base">
            Pilih portal layanan di bawah ini sesuai dengan kebutuhan operasional harian Anda.
          </p>
        </div>

        {/* 3 Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* KARTU 1: Peminjaman Kendaraan */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-kuk-maroon-200 transition-all group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Truck className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Akses Publik</span>
              <h3 className="text-xl font-bold text-gray-900 mt-1 mb-2">Peminjaman Kendaraan</h3>
              <p className="text-sm text-gray-600 mb-6">
                Formulir peminjaman mobil engkel, pickup L300, dan motor operasional toko/gudang.
              </p>
            </div>
            <Link
              to="/public/fleet-booking"
              className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-gray-50 text-gray-900 font-semibold text-sm group-hover:bg-kuk-maroon group-hover:text-white transition-colors"
            >
              <span>Ajukan Peminjaman</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* KARTU 2: Karyawan Mandiri */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-kuk-maroon-200 transition-all group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Portal Mandiri</span>
              <h3 className="text-xl font-bold text-gray-900 mt-1 mb-2">Layanan Karyawan</h3>
              <p className="text-sm text-gray-600 mb-6">
                Pengajuan cuti bulanan resmi dan pencatatan komisi tip pemotongan kaca mandiri.
              </p>
              <div className="space-y-2 mb-6">
                <Link
                  to="/public/leave-request"
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-kuk-maroon p-2 rounded-lg bg-gray-50 hover:bg-kuk-maroon-50/60 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-kuk-maroon" />
                  <span>Pengajuan Cuti (PIN Auth)</span>
                </Link>
                <Link
                  to="/public/glass-tip"
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-kuk-maroon p-2 rounded-lg bg-gray-50 hover:bg-kuk-maroon-50/60 transition-colors"
                >
                  <Scissors className="w-4 h-4 text-kuk-maroon" />
                  <span>Input Tip Potong Kaca (3%)</span>
                </Link>
              </div>
            </div>
            <div className="text-xs text-gray-400 text-center">Dilindungi Verifikasi PIN & Token</div>
          </div>

          {/* KARTU 3: Login Staf */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-kuk-maroon-200 transition-all group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-kuk-maroon-50 text-kuk-maroon flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Lock className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold text-kuk-maroon uppercase tracking-wider">Internal Staf</span>
              <h3 className="text-xl font-bold text-gray-900 mt-1 mb-2">Login Staf & Admin</h3>
              <p className="text-sm text-gray-600 mb-6">
                Masuk ke dashboard manajemen internal sesuai dengan hak akses unit dan peran Anda.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-kuk-maroon text-white font-semibold text-sm hover:bg-kuk-maroon-dark transition-colors shadow-sm"
            >
              <span>Masuk Dashboard</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        © 2026 KUK Management System · Multi-Unit Enterprise Architecture v3.1.0
      </footer>
    </div>
  );
};

