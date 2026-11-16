/**
 * Export tabular data to CSV with UTF-8 BOM for Excel compatibility.
 */
export const exportToCSV = (
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
) => {
  const sanitizeCell = (cell: any): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerRow = headers.map(sanitizeCell).join(',');
  const dataRows = rows.map((r) => r.map(sanitizeCell).join(',')).join('\n');
  const csvContent = '\uFEFF' + headerRow + '\n' + dataRows;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
