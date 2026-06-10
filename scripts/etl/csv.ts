/**
 * Minimal CSV reader for the bball-reference-datasets files. The source CSVs
 * contain no quoted fields (verified at build time), so a plain comma split is
 * sufficient and avoids an extra dependency.
 */

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  if (lines[0].includes('"')) {
    throw new Error("csv.ts: quoted CSV not supported; source format changed");
  }
  const header = lines[0].split(",");
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const row: CsvRow = {};
    for (let c = 0; c < header.length; c++) row[header[c]] = cells[c] ?? "";
    rows.push(row);
  }
  return rows;
}

/** "NA"/"" -> undefined, else Number. */
export function num(v: string | undefined): number | undefined {
  if (v === undefined || v === "" || v === "NA") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
