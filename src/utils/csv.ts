/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.every((c) => c.trim() === '')) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (cols[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

export function normalizePlaceName(raw: string): string {
  return raw
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[.\u2019']/g, '')
    .replace(/[^a-z0-9\u0b80-\u0bff]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
