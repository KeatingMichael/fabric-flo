import type { ItemCondition, ItemKind } from "@/types";

export interface ParsedImportRow {
  kind: ItemKind;
  name: string;
  qrAliases: string[];
  size?: string;
  notes?: string;
  condition?: ItemCondition;
  /** When set, import updates that physical piece instead of adding a new row. */
  id?: string;
}

/** Minimal CSV line parser supporting quoted fields with doubled quotes. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"' && inQ) {
      if (line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = false;
      }
    } else if (c === '"' && !inQ) {
      inQ = true;
    } else if (c === "," && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function normKind(s: string): ItemKind | null {
  const t = s.trim().toLowerCase();
  if (t === "fabric") return "fabric";
  if (t === "bag") return "bag";
  return null;
}

function normCondition(s: string): ItemCondition | undefined {
  const t = s.trim().toLowerCase();
  if (t === "lost") return "lost";
  if (t === "damaged") return "damaged";
  if (t === "ok" || t === "in use") return "ok";
  return undefined;
}

function headerIndex(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parses Fabric Flo export CSV or similar (Kind, Name, Status, QR aliases, …).
 */
export function parseInventoryCsvForImport(csv: string): ParsedImportRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]!);
  const iKind = headerIndex(headers, "kind", "type");
  const iName = headerIndex(headers, "name", "item", "description");
  const iStatus = headerIndex(headers, "status", "condition");
  const iAliases = headerIndex(headers, "qr aliases", "qr_aliases", "aliases", "qr");
  const iNotes = headerIndex(headers, "notes", "note");
  const iSize = headerIndex(headers, "size", "dimensions");
  const iId = headerIndex(headers, "item id", "item_id", "id");

  if (iKind < 0 || iName < 0) return [];

  const rows: ParsedImportRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]!);
    const kindRaw = cells[iKind] ?? "";
    const kind = normKind(kindRaw);
    if (!kind) continue;
    const name = (cells[iName] ?? "").trim();
    if (!name) continue;

    let qrAliases: string[] = [];
    if (iAliases >= 0 && cells[iAliases]) {
      const raw = cells[iAliases]!;
      qrAliases = raw
        .split(/\s*\|\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    let condition: ItemCondition | undefined;
    if (iStatus >= 0 && cells[iStatus]) {
      condition = normCondition(cells[iStatus]!);
    }

    const notes = iNotes >= 0 && cells[iNotes]?.trim() ? cells[iNotes]!.trim() : undefined;
    const size = iSize >= 0 && cells[iSize]?.trim() ? cells[iSize]!.trim() : undefined;
    const id = iId >= 0 && cells[iId]?.trim() ? cells[iId]!.trim() : undefined;

    rows.push({ kind, name, qrAliases, size, notes, condition, id });
  }
  return rows;
}
