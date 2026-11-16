import React, { useState, useEffect } from 'react';
import type { Employee, AttendanceStatus } from '@/types/models';
import { employeeService, attendanceService } from '@/services/dataService';
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  AlertTriangle,
} from 'lucide-react';

interface FingerprintImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitId: string;
  onImportSuccess: (count: number) => void;
}

interface ParsedRecord {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  attendance_date: string;
  check_in_time: string;
  check_out_time: string;
  status: AttendanceStatus;
  late_minutes: number;
  isValid: boolean;
  validationError?: string;
  selected: boolean;
}

export const FingerprintImportModal: React.FC<FingerprintImportModalProps> = ({
  isOpen,
  onClose,
  unitId,
  onImportSuccess,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && unitId) {
      employeeService.getEmployeesByUnit(unitId).then((res) => {
        setEmployees(res.data || []);
      });
      // Reset state
      setFileName(null);
      setParsedRecords([]);
      setParsingError(null);
      setSuccessCount(null);
    }
  }, [isOpen, unitId]);

  const handleDownloadSample = () => {
    const csvContent =
      'employee_code,date,check_in,check_out\n' +
      'EMP-LATANSA-001,2026-11-16,07:45:00,17:05:00\n' +
      'EMP-LATANSA-002,2026-11-16,08:14:00,17:00:00\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sample_fingerprint_${unitId.substring(0, 4)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseFileContent = (content: string, name: string) => {
    setFileName(name);
    setParsingError(null);
    setSuccessCount(null);

    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) {
      setParsingError('Berkas kosong atau tidak memiliki baris data.');
      return;
    }

    // Temporary storage by emp + date
    const map = new Map<
      string,
      {
        empCodeRaw: string;
        date: string;
        timestamps: string[];
      }
    >();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip CSV header if detected
      if (i === 0 && (line.toLowerCase().includes('employee') || line.toLowerCase().includes('nik') || line.toLowerCase().includes('badge'))) {
        continue;
      }

      // Detect separator: Tab, Semicolon, or Comma
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t').map((p) => p.trim());
      } else if (line.includes(';')) {
        parts = line.split(';').map((p) => p.trim());
      } else if (line.includes(',')) {
        parts = line.split(',').map((p) => p.trim());
      } else {
        parts = line.split(/\s+/).map((p) => p.trim());
      }

      if (parts.length < 2) continue;

      let code = parts[0];
      let dateStr = '';
      let timeStr = '';

      if (parts.length >= 4 && parts[1].includes('-') && parts[2].includes(':')) {
        // Format: code, date, check_in, check_out
        dateStr = parts[1];
        const key = `${code}_${dateStr}`;
        if (!map.has(key)) map.set(key, { empCodeRaw: code, date: dateStr, timestamps: [] });
        if (parts[2]) map.get(key)!.timestamps.push(parts[2]);
        if (parts[3]) map.get(key)!.timestamps.push(parts[3]);
        continue;
      }

      // Check if second column has date + time (e.g. 2026-11-16 07:45:00)
      const dateTimePart = parts[1];
      if (dateTimePart.includes(' ') || dateTimePart.includes('T')) {
        const [d, t] = dateTimePart.split(/[ T]/);
        dateStr = d;
        timeStr = t || '08:00:00';
      } else if (parts.length >= 3 && parts[1].includes('-') && parts[2].includes(':')) {
        dateStr = parts[1];
        timeStr = parts[2];
      } else {
        dateStr = new Date().toISOString().slice(0, 10);
        timeStr = parts[1].includes(':') ? parts[1] : '08:00:00';
      }

      const key = `${code}_${dateStr}`;
      if (!map.has(key)) {
        map.set(key, { empCodeRaw: code, date: dateStr, timestamps: [] });
      }
      map.get(key)!.timestamps.push(timeStr);
    }

    if (map.size === 0) {
      setParsingError('Format berkas tidak dikenali. Pastikan menggunakan format CSV atau log ZKTeco yang didukung.');
      return;
    }

    const records: ParsedRecord[] = [];
    let idx = 0;

    map.forEach((val) => {
      idx++;
      val.timestamps.sort();
      const inTime = val.timestamps[0] || '08:00:00';
      const outTime = val.timestamps.length > 1 ? val.timestamps[val.timestamps.length - 1] : '17:00:00';

      // Match employee
      const rawCodeUpper = val.empCodeRaw.toUpperCase();
      let matchedEmp = employees.find(
        (e) =>
          e.employee_code.toUpperCase() === rawCodeUpper ||
          e.id === val.empCodeRaw ||
          e.employee_code.endsWith(rawCodeUpper)
      );

      // Numeric fallback: if raw code is "1", match 1st employee, etc.
      if (!matchedEmp && /^\d+$/.test(val.empCodeRaw)) {
        const empNum = parseInt(val.empCodeRaw, 10);
        if (empNum > 0 && empNum <= employees.length) {
          matchedEmp = employees[empNum - 1];
        }
      }

      // Determine late status (08:00 cutoff)
      const [inH, inM] = inTime.split(':').map(Number);
      const inMinutes = (inH || 0) * 60 + (inM || 0);
      const standardMinutes = 8 * 60; // 08:00
      const isLate = inMinutes > standardMinutes;
      const lateMins = isLate ? inMinutes - standardMinutes : 0;
      const status: AttendanceStatus = isLate ? 'LATE' : 'PRESENT';

      const isValid = !!matchedEmp;

      records.push({
        id: `parsed-${idx}-${Date.now()}`,
        employee_id: matchedEmp ? matchedEmp.id : '',
        employee_code: matchedEmp ? matchedEmp.employee_code : val.empCodeRaw,
        employee_name: matchedEmp ? matchedEmp.full_name : 'Tidak Dikenal (Unknown)',
        attendance_date: val.date,
        check_in_time: inTime,
        check_out_time: outTime,
        status: status,
        late_minutes: lateMins,
        isValid: isValid,
        validationError: isValid ? undefined : `Kode "${val.empCodeRaw}" tidak terdaftar pada unit ini`,
        selected: isValid,
      });
    });

    setParsedRecords(records);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseFileContent(text, file.name);
    };
    reader.readAsText(file);
  };

  const toggleSelectRow = (id: string) => {
    setParsedRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAll = (select: boolean) => {
    setParsedRecords((prev) =>
      prev.map((r) => (r.isValid ? { ...r, selected: select } : r))
    );
  };

  const handleProcessImport = async () => {
    const selected = parsedRecords.filter((r) => r.selected && r.isValid);
    if (selected.length === 0) {
      setParsingError('Pilih minimal 1 baris rekaman valid untuk diimpor.');
      return;
    }

    setIsSubmitting(true);
    setParsingError(null);

    try {
      const res = await attendanceService.importFingerprintBatch(
        unitId,
        selected.map((r) => ({
          employee_id: r.employee_id,
          attendance_date: r.attendance_date,
          check_in_time: r.check_in_time,
          check_out_time: r.check_out_time,
          status: r.status,
          late_minutes: r.late_minutes,
          source: 'FINGERPRINT',
        }))
      );

      if (res.success) {
        setSuccessCount(res.count);
        onImportSuccess(res.count);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setParsingError(res.message);
      }
    } catch (err: any) {
      setParsingError(err?.message || 'Terjadi kesalahan saat memproses impor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const validCount = parsedRecords.filter((r) => r.isValid).length;
  const selectedCount = parsedRecords.filter((r) => r.selected && r.isValid).length;
  const unknownCount = parsedRecords.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-kuk-maroon text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-kuk-gold" />
            <h2 className="font-bold text-sm">Sinkronisasi & Impor Log Fingerprint</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {successCount !== null ? (
            <div className="p-6 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-emerald-900">Impor Presensi Berhasil!</h3>
              <p className="text-emerald-700">
                Sebanyak <strong>{successCount} rekaman log absensi</strong> telah berhasil disinkronkan ke dalam rekapitulasi kehadiran harian unit.
              </p>
            </div>
          ) : (
            <>
              {/* Instructions & Sample button */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-center justify-between">
                <div>
                  <div className="font-bold">Protokol Log Biometrik Mandiri:</div>
                  <p className="text-[11px] text-blue-800">
                    Mendukung berkas <code>.dat</code>, <code>.csv</code>, dan <code>.txt</code> standar mesin ZKTeco / Solution.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-2xs flex items-center gap-1 transition-colors shrink-0 ml-3"
                >
                  <Download className="w-3 h-3" />
                  <span>Unduh Contoh CSV</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center space-y-2 hover:border-kuk-maroon/50 transition-colors bg-gray-50/50">
                <UploadCloud className="w-7 h-7 text-gray-400 mx-auto" />
                <div className="text-gray-800 font-semibold">
                  {fileName ? (
                    <span className="text-kuk-maroon flex items-center justify-center gap-1.5 font-bold">
                      <FileText className="w-4 h-4" /> {fileName}
                    </span>
                  ) : (
                    'Pilih atau Tarik Berkas Log Mesin Presensi'
                  )}
                </div>
                <div className="text-gray-400 text-[11px]">Format didukung: .dat, .csv, .txt (ZKTeco / Solution standard)</div>

                <input
                  type="file"
                  accept=".dat,.csv,.txt"
                  className="hidden"
                  id="fp-upload-file"
                  onChange={handleFileUpload}
                />
                <label
                  htmlFor="fp-upload-file"
                  className="inline-block mt-1 px-4 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium rounded-lg cursor-pointer shadow-2xs"
                >
                  {fileName ? 'Ganti Berkas...' : 'Pilih Berkas Lokal'}
                </label>
              </div>

              {parsingError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{parsingError}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedRecords.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">Pratinjau Data Impor:</span>
                      <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-100 text-emerald-800">
                        {validCount} Valid
                      </span>
                      {unknownCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-rose-100 text-rose-800">
                          {unknownCount} Tidak Dikenal
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-2xs">
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(true)}
                        className="text-blue-600 hover:underline"
                      >
                        Pilih Semua Valid
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(false)}
                        className="text-gray-500 hover:underline"
                      >
                        Lepas Pilihan
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-2xs">
                      <thead className="bg-gray-100 text-gray-700 sticky top-0">
                        <tr>
                          <th className="p-2 w-8 text-center">Pilih</th>
                          <th className="p-2">Karyawan</th>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Masuk</th>
                          <th className="p-2">Pulang</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Validasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRecords.map((r) => (
                          <tr
                            key={r.id}
                            className={`hover:bg-gray-50/80 ${!r.isValid ? 'bg-rose-50/40 text-rose-900' : ''}`}
                          >
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={r.selected}
                                disabled={!r.isValid}
                                onChange={() => toggleSelectRow(r.id)}
                                className="rounded text-kuk-maroon focus:ring-kuk-maroon disabled:opacity-30"
                              />
                            </td>
                            <td className="p-2 font-medium">
                              <div>{r.employee_name}</div>
                              <div className="text-gray-400 font-mono text-[10px]">{r.employee_code}</div>
                            </td>
                            <td className="p-2 font-mono">{r.attendance_date}</td>
                            <td className="p-2 font-mono font-semibold">{r.check_in_time}</td>
                            <td className="p-2 font-mono">{r.check_out_time}</td>
                            <td className="p-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  r.status === 'LATE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {r.status === 'LATE' ? `Terlambat (${r.late_minutes}m)` : 'Tepat Waktu'}
                              </span>
                            </td>
                            <td className="p-2">
                              {r.isValid ? (
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Valid
                                </span>
                              ) : (
                                <span className="text-rose-600 font-semibold flex items-center gap-1" title={r.validationError}>
                                  <AlertTriangle className="w-3 h-3" /> Tidak Dikenal
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
          <div className="text-gray-500">
            {parsedRecords.length > 0 && <span>Terpilih: <strong>{selectedCount}</strong> dari {validCount} rekaman valid</span>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {successCount !== null ? 'Selesai' : 'Batal'}
            </button>
            {parsedRecords.length > 0 && successCount === null && (
              <button
                type="button"
                onClick={handleProcessImport}
                disabled={isSubmitting || selectedCount === 0}
                className="px-4 py-2 font-semibold bg-kuk-maroon hover:bg-kuk-maroon/90 text-white rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span>Memproses...</span>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 text-kuk-gold" />
                    <span>Impor ({selectedCount}) Rekaman</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
