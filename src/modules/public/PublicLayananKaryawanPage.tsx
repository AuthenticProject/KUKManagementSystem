import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Scissors } from 'lucide-react';
import { PublicLeaveRequestPage } from './PublicLeaveRequestPage';
import { PublicGlassTipPage } from './PublicGlassTipPage';

export const PublicLayananKaryawanPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cuti' | 'tip'>('cuti');

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between relative overflow-x-hidden">
      {/* Decorative Brand Top Banner */}
      <div className="h-2 bg-gradient-to-r from-[#540000] via-[#FFCC00] to-[#540000]" />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-[#E5E5E5] px-4 sm:px-8 py-3.5 shadow-xs sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-[#540000] text-gray-700 hover:text-white text-xs font-bold transition-all border border-gray-200 hover:border-transparent group"
              title="Kembali ke Beranda Landing Page"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#FFCC00] transition-colors" />
              <span>Kembali ke Beranda</span>
            </Link>
            <div className="hidden sm:block border-l border-gray-200 pl-3">
              <div className="text-xs font-black text-[#540000] uppercase tracking-wider font-display">
                Portal Layanan Karyawan TB KUK
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">
                Layanan Mandiri Cuti & Tip Pemotongan Kaca
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('cuti')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'cuti' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Pengajuan Cuti</span>
            </button>
            <button
              onClick={() => setActiveTab('tip')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'tip' ? 'bg-white text-[#540000] shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Tip Potong Kaca</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Embed Content */}
      <div className="flex-1">
        {activeTab === 'cuti' ? (
          <PublicLeaveRequestPage />
        ) : (
          <PublicGlassTipPage />
        )}
      </div>
    </div>
  );
};
