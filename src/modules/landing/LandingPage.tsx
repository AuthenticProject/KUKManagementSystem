import React from 'react';
import { Link } from 'react-router-dom';
import { Truck, Users, Lock, ChevronRight, Scissors, Calendar, ShieldCheck } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between relative overflow-hidden">
      {/* Decorative Brand Top Banner */}
      <div className="h-2 bg-gradient-to-r from-[#540000] via-[#FFCC00] to-[#540000]" />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <img
            src="/brand/logos/kul-horizontal.png"
            alt="KUK Logo"
            className="h-10 sm:h-11 w-auto object-contain select-none"
          />
          <div className="hidden sm:block border-l border-gray-200 pl-3">
            <h1 className="font-extrabold text-sm text-[#540000] uppercase tracking-tight font-display">
              KUK Management System
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">TB KUK La Tansa · KUK Palen</p>
          </div>
        </div>

        <Link
          to="/login"
          className="text-xs sm:text-sm font-bold text-white bg-[#540000] hover:bg-[#3B0000] px-4 py-2 rounded-xl transition-all shadow-xs border border-transparent hover:shadow-brand flex items-center gap-2"
        >
          <Lock className="w-3.5 h-3.5 text-[#FFCC00]" />
          <span>Portal Staf</span>
        </Link>
      </header>

      {/* Hero Content */}
      <main className="max-w-6xl mx-auto px-4 py-10 sm:py-16 w-full flex-1 flex flex-col justify-center relative z-10">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#540000] uppercase bg-[#FCE7E7] border border-[#F7C5C5] px-3.5 py-1 rounded-full shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#996414]" />
            Portal Layanan Terpadu KUK
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-4 tracking-tight font-display">
            Pusat Operasional, Karyawan & Armada
          </h2>
          <p className="text-gray-600 mt-2 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Pilih portal layanan mandiri atau masuk ke dashboard manajemen untuk mengelola operasional harian CV Karya Utama Kreasi.
          </p>
          <div className="w-24 h-1 bg-[#FFCC00] mx-auto mt-4 rounded-full" />
        </div>

        {/* 3 Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* KARTU 1: Peminjaman Kendaraan */}
          <div className="bg-white rounded-3xl border border-[#E5E5E5] p-6 sm:p-8 flex flex-col justify-between shadow-brand-card hover:shadow-brand hover:border-[#540000]/30 transition-all group relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-[#540000]" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#540000]/5 text-[#540000] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Truck className="w-6 h-6 text-[#540000]" />
              </div>
              <span className="text-[10px] font-bold text-[#996414] uppercase tracking-wider bg-[#FFF9D6] px-2 py-0.5 rounded-md border border-[#FFE066]">
                Akses Kiosk Publik
              </span>
              <h3 className="text-xl font-extrabold text-gray-900 mt-2 mb-2 font-display">
                Peminjaman Kendaraan
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-6 leading-relaxed">
                Formulir peminjaman mobil pick up L300, Avanza, truk engkel, forklift, dan roda tiga operasional toko/gudang.
              </p>
            </div>
            <Link
              to="/public/fleet-booking"
              className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-[#F8F9FA] text-gray-900 font-bold text-xs sm:text-sm group-hover:bg-[#540000] group-hover:text-white transition-all border border-[#E5E5E5]"
            >
              <span>Ajukan Peminjaman</span>
              <ChevronRight className="w-4 h-4 text-[#FFCC00]" />
            </Link>
          </div>

          {/* KARTU 2: Karyawan Mandiri */}
          <div className="bg-white rounded-3xl border border-[#E5E5E5] p-6 sm:p-8 flex flex-col justify-between shadow-brand-card hover:shadow-brand hover:border-[#FFCC00] transition-all group relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-[#FFCC00]" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#FFF9D6] text-[#996414] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6 text-[#996414]" />
              </div>
              <span className="text-[10px] font-bold text-[#540000] uppercase tracking-wider bg-[#FCE7E7] px-2 py-0.5 rounded-md border border-[#F7C5C5]">
                Portal Mandiri Karyawan
              </span>
              <h3 className="text-xl font-extrabold text-gray-900 mt-2 mb-2 font-display">
                Layanan Karyawan
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-6 leading-relaxed">
                Pengajuan cuti bulanan resmi dan pencatatan komisi tip pemotongan kaca mandiri (formula 3% harga dasar).
              </p>
              <div className="space-y-2 mb-6">
                <Link
                  to="/public/leave-request"
                  className="flex items-center gap-2.5 text-xs font-semibold text-gray-800 hover:text-[#540000] p-2.5 rounded-xl bg-[#F8F9FA] hover:bg-[#FDF2F2] border border-[#E5E5E5] transition-colors"
                >
                  <Calendar className="w-4 h-4 text-[#540000]" />
                  <span>Pengajuan Cuti (Kalender Mandiri)</span>
                </Link>
                <Link
                  to="/public/glass-tip"
                  className="flex items-center gap-2.5 text-xs font-semibold text-gray-800 hover:text-[#540000] p-2.5 rounded-xl bg-[#F8F9FA] hover:bg-[#FDF2F2] border border-[#E5E5E5] transition-colors"
                >
                  <Scissors className="w-4 h-4 text-[#996414]" />
                  <span>Input Tip Potong Kaca (3%)</span>
                </Link>
              </div>
            </div>
            <Link
              to="/layanan-karyawan"
              className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-[#F8F9FA] text-gray-900 font-bold text-xs sm:text-sm group-hover:bg-[#540000] group-hover:text-white transition-all border border-[#E5E5E5]"
            >
              <span>Buka Layanan Karyawan</span>
              <ChevronRight className="w-4 h-4 text-[#FFCC00]" />
            </Link>
          </div>

          {/* KARTU 3: Login Staf */}
          <div className="bg-white rounded-3xl border border-[#E5E5E5] p-6 sm:p-8 flex flex-col justify-between shadow-brand-card hover:shadow-brand hover:border-[#540000]/30 transition-all group relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-[#540000]" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#540000]/5 text-[#540000] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Lock className="w-6 h-6 text-[#540000]" />
              </div>
              <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                Akses Terproteksi
              </span>
              <h3 className="text-xl font-extrabold text-gray-900 mt-2 mb-2 font-display">
                Portal Staf & Manajemen
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-6 leading-relaxed">
                Khusus staf berwenang, kepala toko, HRD, kasir, admin unit, finance, dan pimpinan untuk mengelola sistem.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-[#540000] text-white font-bold text-xs sm:text-sm hover:bg-[#3B0000] transition-colors shadow-xs"
            >
              <span>Masuk Portal Staf</span>
              <ChevronRight className="w-4 h-4 text-[#FFCC00]" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5E5E5] py-6 px-4 text-center">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 font-medium">
          <div>
            © 2026 CV Karya Utama Kreasi. Seluruh Hak Cipta Dilindungi.
          </div>
          <div className="text-[11px] text-gray-400">
            KUK Management System v3.1.0 · Official Enterprise Brand
          </div>
        </div>
      </footer>
    </div>
  );
};
