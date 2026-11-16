import React from 'react';
import { getUnitBrandInfo } from '@/utils/brandAssets';

interface PrintHeaderProps {
  title: string;
  documentNumber?: string;
  unitName?: string;
  unitCode?: string;
  date?: string;
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({
  title,
  documentNumber,
  unitName = 'TB KUK La Tansa',
  unitCode,
  date = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
}) => {
  const brand = getUnitBrandInfo(unitCode || unitName);

  return (
    <div className="border-b-2 border-[#540000] pb-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={brand.logoHorizontal}
            alt="KUK Logo"
            className="h-12 w-auto object-contain print:h-10"
          />
          <div className="border-l border-gray-300 pl-3.5">
            <div className="text-base font-extrabold text-[#540000] tracking-tight uppercase font-display">
              CV KARYA UTAMA KREASI
            </div>
            <div className="text-xs text-gray-700 font-medium">
              Unit Operasional: <span className="font-bold text-gray-900">{unitName}</span>
              {unitCode && <span className="text-gray-500 font-mono text-[11px] ml-1">({unitCode})</span>}
            </div>
            <div className="text-[10px] text-gray-500">
              Dokumen Operasional Resmi & Terkendali
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-[#540000] text-white font-bold text-xs uppercase rounded-md shadow-2xs">
            {title}
          </span>
          {documentNumber && (
            <div className="font-mono text-[11px] text-gray-600 mt-1 font-semibold">
              No: {documentNumber}
            </div>
          )}
          <div className="text-[10px] text-gray-500 mt-0.5">
            Dicetak: {date}
          </div>
        </div>
      </div>
      <div className="mt-3.5 h-[2px] bg-gradient-to-r from-[#FFCC00] via-[#996414] to-[#540000]" />
    </div>
  );
};
