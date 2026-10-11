/**
 * Shared CSV Writer Utility
 * Standardized across Reports, Migration, and Departmental exports.
 * 
 * Features:
 * 1. UTF-8 Encoding with Byte Order Mark (BOM: \uFEFF) for 100% Excel Urdu & UTF-8 fidelity.
 * 2. Formula Injection Protection: Neutralizes spreadsheet injection by prefixing
 *    cells starting with '=', '+', '-', or '@' with a single apostrophe (').
 * 3. RFC 4180 Escaping: Correctly quotes cells containing commas, quotes, or newlines.
 * 4. Chunked/Streamed Blob Generation: Handles large catalogs without browser memory stalls.
 */

export interface CsvColumn<T = Record<string, unknown>> {
  header: string;
  key?: keyof T | string;
  format?: (row: T) => string | number | boolean | null | undefined;
}

export class SharedCsvWriter {
  /**
   * Neutralizes formula injection vulnerabilities for spreadsheet applications (Excel, Calc, Google Sheets).
   * Any cell starting with =, +, -, @, or tab/carriage return is prefixed with a single quote.
   */
  static sanitizeCellValue(val: unknown): string {
    if (val === null || val === undefined) {
      return '';
    }
    let str = String(val);

    // If string begins with unsafe characters that trigger formula execution in Excel/Calc:
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    return str;
  }

  /**
   * Escapes a value according to RFC 4180
   */
  static escapeField(val: unknown): string {
    const sanitized = this.sanitizeCellValue(val);
    // If field contains quotes, commas, or newlines, enclose in quotes and double internal quotes
    if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('\r')) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return `"${sanitized}"`;
  }

  /**
   * Builds CSV content as a Blob with UTF-8 BOM
   */
  static buildCsvBlob<T = Record<string, unknown>>(
    data: T[],
    columns?: CsvColumn<T>[] | string[]
  ): Blob {
    const chunks: string[] = ['\uFEFF']; // UTF-8 BOM

    if (!data || data.length === 0) {
      if (columns && columns.length > 0) {
        const headerNames = columns.map(c => typeof c === 'string' ? c : c.header);
        chunks.push(headerNames.map(h => this.escapeField(h)).join(',') + '\r\n');
      }
      return new Blob(chunks, { type: 'text/csv;charset=utf-8;' });
    }

    // Determine resolved columns
    let resolvedCols: { header: string; getValue: (item: T) => unknown }[] = [];

    if (columns && columns.length > 0) {
      resolvedCols = columns.map(col => {
        if (typeof col === 'string') {
          return {
            header: col,
            getValue: (item: T) => (item as Record<string, unknown>)[col],
          };
        }
        return {
          header: col.header,
          getValue: (item: T) => {
            if (col.format) return col.format(item);
            if (col.key) return (item as Record<string, unknown>)[col.key as string];
            return (item as Record<string, unknown>)[col.header];
          },
        };
      });
    } else {
      const sample = data[0] as Record<string, unknown>;
      const keys = Object.keys(sample);
      resolvedCols = keys.map(k => ({
        header: k,
        getValue: (item: T) => (item as Record<string, unknown>)[k],
      }));
    }

    // Headers line
    const headerLine = resolvedCols.map(c => this.escapeField(c.header)).join(',') + '\r\n';
    chunks.push(headerLine);

    // Stream lines in chunks of 500 rows to ensure snappy UI and minimal GC pauses
    const chunkSize = 500;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const lines = chunk.map(row => {
        return resolvedCols.map(col => this.escapeField(col.getValue(row))).join(',');
      }).join('\r\n') + '\r\n';
      chunks.push(lines);
    }

    return new Blob(chunks, { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Generates and downloads a CSV file directly in browser
   */
  static downloadCsv<T = Record<string, unknown>>(
    data: T[],
    filename: string,
    columns?: CsvColumn<T>[] | string[]
  ): void {
    const blob = this.buildCsvBlob(data, columns);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
