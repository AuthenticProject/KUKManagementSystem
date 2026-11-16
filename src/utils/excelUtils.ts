/**
 * EXCEL IMPORT & EXPORT UTILITIES — KUK MANAGEMENT SYSTEM v3.1.0
 * Powered by SheetJS (xlsx) with UTF-8 support and column auto-sizing.
 */

import * as XLSX from 'xlsx';

/**
 * Export data to native Microsoft Excel (.xlsx) file
 */
export const exportToExcel = (
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
) => {
  // 1. Build Sheet from Array of Arrays
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // 2. Calculate dynamic column widths
  const colWidths = headers.map((h, i) => {
    let maxLen = h.length;
    rows.forEach((row) => {
      const cellVal = row[i];
      if (cellVal !== null && cellVal !== undefined) {
        maxLen = Math.max(maxLen, String(cellVal).length);
      }
    });
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
  ws['!cols'] = colWidths;

  // 3. Create Workbook & Append Sheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31) || 'Sheet1');

  // 4. Trigger Download (.xlsx)
  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safeFilename);
};

/**
 * Generate and download an Excel template file for bulk imports
 */
export const downloadExcelTemplate = (
  filename: string,
  sheetName: string,
  headers: string[],
  sampleRows: (string | number | boolean | null | undefined)[][] = []
) => {
  exportToExcel(filename, sheetName, headers, sampleRows);
};

/**
 * Parse an uploaded Excel (.xlsx, .xls) or CSV file into structured headers and rows
 */
export const parseExcelFile = async (
  file: File
): Promise<{
  headers: string[];
  rawRows: (string | number | boolean | null | undefined)[][];
  objects: Record<string, any>[];
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) {
          throw new Error('File tidak memiliki data atau kosong.');
        }

        const wb = XLSX.read(buffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          throw new Error('Lembar kerja (worksheet) tidak ditemukan di dalam file.');
        }

        const ws = wb.Sheets[sheetName];
        // Read as array of arrays
        const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!aoa || aoa.length === 0) {
          throw new Error('File Excel tidak memiliki baris data.');
        }

        // Header is row 0
        const headers = (aoa[0] || []).map((h) => String(h || '').trim());
        // Data rows
        const rawRows = aoa.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''));

        // Object mapping using headers
        const objects = rawRows.map((r) => {
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            if (h) {
              obj[h] = r[idx] !== undefined ? r[idx] : '';
            }
          });
          return obj;
        });

        resolve({ headers, rawRows, objects });
      } catch (err: any) {
        reject(new Error(err?.message || 'Gagal memproses file Excel. Pastikan format valid (.xlsx, .xls, .csv).'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file dari penyimpanan lokal.'));
    };

    reader.readAsArrayBuffer(file);
  });
};
