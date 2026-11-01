/** Célula de planilha lida do CSV. */
export type Cell = string | number | Date | null;

/** Lê CSV (UTF-8 ou Latin-1, separado por ; , ou tab), com aspas. */
export function parseCsv(buf: Buffer): Cell[][] {
  let s = buf.toString('utf8');
  if (s.includes('�')) s = buf.toString('latin1');
  s = s.replace(/^﻿/, '');
  const first = s.split(/\r?\n/, 1)[0] ?? '';
  const delim = [';', ',', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') (field += '"'), i++;
        else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) row.push(field.trim() || null), (field = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field.trim() || null);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) row.push(field.trim() || null), rows.push(row);
  return rows;
}
