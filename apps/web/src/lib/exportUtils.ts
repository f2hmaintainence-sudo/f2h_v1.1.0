// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : exportUtils.ts
// Description : Export structured dataset to native Excel (.xlsx) and CSV
// ============================================================================

import * as XLSX from 'xlsx';

export interface ExportColumn<T = any> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
}

/**
 * Downloads data as a native Microsoft Excel (.xlsx) file.
 */
export function downloadExcel<T = any>(
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  data: T[]
) {
  const formattedRows = data.map((row) => {
    const rowObj: Record<string, any> = {};
    columns.forEach((col) => {
      let val = col.accessor(row);
      if (val === null || val === undefined) val = '';
      if (typeof val === 'string') {
        val = val.replace(/<[^>]*>/g, '').trim();
      }
      rowObj[col.header] = val;
    });
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedRows);

  // Auto column widths
  const colWidths = columns.map((col) => {
    let maxLen = col.header.length;
    data.forEach((row) => {
      const val = col.accessor(row);
      if (val !== null && val !== undefined) {
        const strLen = String(val).replace(/<[^>]*>/g, '').trim().length;
        if (strLen > maxLen) maxLen = strLen;
      }
    });
    return { wch: Math.min(Math.max(maxLen + 3, 10), 60) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}

/**
 * Downloads data as a CSV file with UTF-8 BOM for Excel compatibility.
 */
export function downloadCSV<T = any>(
  filename: string,
  columns: ExportColumn<T>[],
  data: T[]
) {
  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const cleanStr = String(val).replace(/<[^>]*>/g, '').replace(/"/g, '""').trim();
    return `"${cleanStr}"`;
  };

  const headers = columns.map((c) => escapeCsv(c.header)).join(',');
  const rows = data.map((row) =>
    columns.map((c) => escapeCsv(c.accessor(row))).join(',')
  );

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
