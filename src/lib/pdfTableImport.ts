import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export function isPdfFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".pdf") || file.type === "application/pdf";
}

function escapeCsvCell(value: string): string {
  const s = value.trim();
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function tableRowsToCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((c) => escapeCsvCell(String(c ?? ""))).join(","))
    .join("\n");
}

type PdfTextItem = { str: string; transform: number[] };

function groupTextIntoTableRows(items: PdfTextItem[]): string[][] {
  const positioned = items
    .map((item) => ({
      str: item.str,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
    }))
    .filter((t) => t.str.trim().length > 0);

  positioned.sort((a, b) => b.y - a.y || a.x - b.x);

  const lineTol = 4;
  const colGap = 14;

  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];

  for (const p of positioned) {
    let line = lines.find((l) => Math.abs(l.y - p.y) <= lineTol);
    if (!line) {
      line = { y: p.y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x: p.x, str: p.str });
  }

  return lines.map((line) => {
    line.parts.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let cell = "";
    let lastX = -1e9;
    for (const part of line.parts) {
      if (cell && part.x - lastX > colGap) {
        cells.push(cell.trim());
        cell = part.str;
      } else {
        cell = cell ? `${cell} ${part.str}` : part.str;
      }
      lastX = part.x;
    }
    if (cell.trim()) cells.push(cell.trim());
    return cells;
  });
}

function normHeader(cell: string): string {
  return cell.trim().toLowerCase();
}

function rowLooksLikeInventoryHeader(cells: string[]): boolean {
  const h = cells.map(normHeader);
  const hasKind = h.some((c) => c === "kind" || c === "type" || c === "item kind");
  const hasName = h.some((c) => c === "name" || c === "item name" || c === "description");
  return hasKind && hasName;
}

function rowLooksLikeLogHeader(cells: string[]): boolean {
  const h = cells.map(normHeader);
  const hasKind = h.some((c) => c === "item kind" || c === "kind");
  const hasName = h.some((c) => c === "item name" || c === "name");
  const hasLoc = h.some((c) => c === "location" || c === "location label");
  return hasKind && hasName && hasLoc;
}

function sameHeaderRow(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => normHeader(c) === normHeader(b[i] ?? ""));
}

function sliceTableFromHeader(
  rows: string[][],
  matchesHeader: (cells: string[]) => boolean
): string[][] {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if (matchesHeader(rows[i] ?? [])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const headers = rows[headerIdx]!;
  const out: string[][] = [headers];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (!row.some((c) => c.trim())) continue;
    if (sameHeaderRow(row, headers)) continue;
    out.push(row);
  }

  return out;
}

/** Fallback when rental-house PDFs lack Kind/Name headers: first col = kind or name only. */
function fallbackInventoryRows(rows: string[][]): string[][] {
  const data = rows.filter((r) => r.some((c) => c.trim()));
  if (data.length === 0) return [];

  const out: string[][] = [["Kind", "Name", "Size", "Status", "Notes"]];
  for (const row of data) {
    const c0 = (row[0] ?? "").trim();
    const c1 = (row[1] ?? "").trim();
    const kindFrom0 = c0.toLowerCase();
    if (kindFrom0 === "fabric" || kindFrom0 === "bag") {
      if (!c1) continue;
      out.push([c0, c1, row[2] ?? "", row[3] ?? "", row[4] ?? ""]);
    } else if (c0) {
      out.push(["fabric", c0, row[1] ?? "", row[2] ?? "", row[3] ?? ""]);
    }
  }
  return out.length > 1 ? out : [];
}

async function extractAllTableRows(file: File): Promise<string[][]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const all: string[][] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageRows = groupTextIntoTableRows(content.items as PdfTextItem[]);
    all.push(...pageRows);
  }

  return all;
}

export async function pdfToInventoryCsv(file: File): Promise<string> {
  const rows = await extractAllTableRows(file);
  let table = sliceTableFromHeader(rows, rowLooksLikeInventoryHeader);
  if (table.length < 2) {
    table = fallbackInventoryRows(rows);
  }
  if (table.length < 2) {
    throw new Error(
      "Could not find a rental list table in this PDF. Use a Fabric Flo CSV/PDF export, or a sheet with Kind and Name columns."
    );
  }
  return tableRowsToCsv(table);
}

export async function pdfToScanLogCsv(file: File): Promise<string> {
  const rows = await extractAllTableRows(file);
  const table = sliceTableFromHeader(rows, rowLooksLikeLogHeader);
  if (table.length < 2) {
    throw new Error(
      "Could not find a scan log table in this PDF. Use a Fabric Flo CSV/PDF export with Item kind, Item name, and Location columns."
    );
  }
  return tableRowsToCsv(table);
}

export async function readUploadFileAsCsvText(
  file: File,
  mode: "inventory" | "log"
): Promise<string> {
  if (!isPdfFile(file)) return file.text();
  return mode === "inventory" ? pdfToInventoryCsv(file) : pdfToScanLogCsv(file);
}
