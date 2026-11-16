import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { parseExcelFile, downloadExcelTemplate } from '@/utils/excelUtils';

export interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  templateFilename: string;
  templateSheetName: string;
  templateHeaders: string[];
  templateSampleRows?: (string | number | boolean | null | undefined)[][];
  onImport: (parsedRows: Record<string, any>[]) => Promise<{ success: boolean; message: string; count?: number }>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'Unggah file spreadsheet untuk memasukkan data secara massal ke sistem KUK.',
  templateFilename,
  templateSheetName,
  templateHeaders,
  templateSampleRows = [],
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedObjects, setParsedObjects] = useState<Record<string, any>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    downloadExcelTemplate(templateFilename, templateSheetName, templateHeaders, templateSampleRows);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);
    setSuccessMsg(null);
    setFile(selected);
    setParsing(true);

    try {
      const result = await parseExcelFile(selected);
      if (result.objects.length === 0) {
        throw new Error('File tidak memiliki baris data yang valid.');
      }
      setHeaders(result.headers);
      setParsedObjects(result.objects);
    } catch (err: any) {
      setError(err?.message || 'Gagal memproses file Excel.');
      setFile(null);
      setParsedObjects([]);
      setHeaders([]);
    } finally {
      setParsing(false);
    }
  };

  const handleResetFile = () => {
    setFile(null);
    setHeaders([]);
    setParsedObjects([]);
    setError(null);
    setSuccessMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExecuteImport = async () => {
    if (parsedObjects.length === 0) return;
    setImporting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await onImport(parsedObjects);
      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          onClose();
          handleResetFile();
        }, 1500);
      } else {
        setError(res.message || 'Gagal mengimpor data.');
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan sistem saat proses import.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-[#540000] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FFCC00]/20 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-[#FFCC00]" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">{title}</h2>
              <p className="text-[11px] text-white/80">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          {/* Template Download Advisory Box */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-700" />
                <span>Format Spreadsheet Resmi KUK</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Gunakan template standar agar header kolom terbaca akurat oleh sistem otomatis.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/70 rounded-xl font-bold text-xs shadow-2xs transition-all shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Unduh Template Excel</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Pilih File Spreadsheet (.xlsx, .xls, .csv)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
              id="excel-file-input"
            />

            {!file ? (
              <label
                htmlFor="excel-file-input"
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-kuk-maroon rounded-2xl cursor-pointer bg-gray-50/60 hover:bg-gray-50 transition-all text-center group"
              >
                <div className="p-3 bg-white group-hover:bg-kuk-maroon/10 rounded-2xl border border-gray-200 group-hover:border-kuk-maroon/20 mb-2 transition-colors">
                  <Upload className="w-6 h-6 text-gray-400 group-hover:text-kuk-maroon" />
                </div>
                <span className="font-bold text-gray-800 text-xs">
                  Klik untuk memilih file spreadsheet
                </span>
                <span className="text-[11px] text-gray-400 mt-0.5">
                  Mendukung Microsoft Excel (.xlsx, .xls) dan CSV UTF-8
                </span>
              </label>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-xs">{file.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {(file.size / 1024).toFixed(1)} KB • {parsedObjects.length} baris data terdeteksi
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResetFile}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Ganti File
                </button>
              </div>
            )}
          </div>

          {/* Parsing State */}
          {parsing && (
            <div className="text-center py-4 text-xs text-gray-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-kuk-maroon" />
              <span>Membaca dan memvalidasi struktur Excel...</span>
            </div>
          )}

          {/* Error Advisory */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Advisory */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Data Preview Table (First 5 rows) */}
          {parsedObjects.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-800 text-xs">
                  Pratinjau Data (5 dari {parsedObjects.length} baris):
                </span>
                <span className="text-[10px] text-gray-500">
                  {headers.length} kolom terdeteksi
                </span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-x-auto max-h-48">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0">
                    <tr>
                      <th className="px-3 py-2 border-b border-gray-200">#</th>
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 border-b border-gray-200 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedObjects.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-mono text-gray-400">{idx + 1}</td>
                        {headers.map((h, i) => (
                          <td key={i} className="px-3 py-1.5 whitespace-nowrap text-gray-700">
                            {String(row[h] !== undefined ? row[h] : '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={importing || parsedObjects.length === 0}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-kuk-maroon hover:bg-[#3B0000] rounded-xl disabled:opacity-50 transition-all shadow-xs"
          >
            {importing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Mengimpor {parsedObjects.length} Baris...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-kuk-gold" />
                <span>Import Sekarang ({parsedObjects.length} Baris)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
