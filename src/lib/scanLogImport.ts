import { parseCsvLine } from "@/lib/inventoryImport";
import type { ItemKind, LocationKind, ScanMethod } from "@/types";
import { LOCATION_KIND_LABEL } from "@/types";

export interface ParsedScanLogRow {
  scannedAt: string;
  itemKind: ItemKind;
  itemName: string;
  locationLabel: string;
  locationKind: LocationKind;
  scanMethod: ScanMethod;
  rawQr: string;
}

function headerIndex(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const cand of candidates) {
    const idx = lower.indexOf(cand.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function normItemKind(s: string): ItemKind | null {
  const t = s.trim().toLowerCase();
  if (t === "fabric") return "fabric";
  if (t === "bag") return "bag";
  return null;
}

function normLocationKind(s: string): LocationKind | null {
  const t = s.trim().toLowerCase();
  if (t === "studio") return "studio";
  if (t === "filming_location" || t === "filming location") return "filming_location";
  if (t === "transport_truck" || t === "transport truck") return "transport_truck";
  for (const [kind, label] of Object.entries(LOCATION_KIND_LABEL)) {
    if (label.toLowerCase() === t) return kind as LocationKind;
  }
  return null;
}

function normScanMethod(s: string): ScanMethod {
  const t = s.trim().toLowerCase();
  if (t === "handwritten label" || t === "label") return "label";
  if (t === "manual entry" || t === "manual") return "manual";
  return "qr";
}

function parseScannedAt(raw: string): string {
  const t = raw.trim();
  if (!t) return new Date().toISOString();
  const ms = Date.parse(t);
  if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  return new Date().toISOString();
}

/** Parses Fabric Flo scan log export CSV. */
export function parseScanLogCsvForImport(csv: string): ParsedScanLogRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]!);
  const iWhen = headerIndex(headers, "date & time (local)", "scanned at", "date", "time");
  const iKind = headerIndex(headers, "item kind", "kind");
  const iName = headerIndex(headers, "item name", "name");
  const iLoc = headerIndex(headers, "location", "location label");
  const iLocKind = headerIndex(headers, "location type", "location kind");
  const iMethod = headerIndex(headers, "scan method", "method");
  const iRaw = headerIndex(headers, "raw scan text", "raw qr", "raw");

  if (iKind < 0 || iName < 0 || iLoc < 0) return [];

  const rows: ParsedScanLogRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]!);
    const itemKind = normItemKind(cells[iKind] ?? "");
    if (!itemKind) continue;
    const itemName = (cells[iName] ?? "").trim();
    if (!itemName) continue;
    const locationLabel = (cells[iLoc] ?? "").trim();
    if (!locationLabel) continue;

    let locationKind: LocationKind = "studio";
    if (iLocKind >= 0 && cells[iLocKind]) {
      locationKind = normLocationKind(cells[iLocKind]!) ?? "studio";
    }

    const scannedAt = iWhen >= 0 ? parseScannedAt(cells[iWhen] ?? "") : new Date().toISOString();
    const scanMethod = iMethod >= 0 ? normScanMethod(cells[iMethod] ?? "") : "qr";
    const rawQr = (iRaw >= 0 ? cells[iRaw] : "")?.trim() || itemName;

    rows.push({
      scannedAt,
      itemKind,
      itemName,
      locationLabel,
      locationKind,
      scanMethod,
      rawQr,
    });
  }
  return rows;
}
