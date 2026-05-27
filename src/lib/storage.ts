import {
  effectiveItemCondition,
  type AppData,
  type InventoryItem,
  type Production,
  type ScanLogEntry,
} from "@/types";
import { getHandwrittenMarks } from "@/lib/labelText";
import { SCAN_METHOD_LABEL } from "@/lib/scanResolve";

export const STORAGE_KEY = "fabric-flo-app-v1";

const emptyData = (): AppData => ({
  productions: [],
  scanLog: [],
  activeProductionId: null,
  productionVersions: undefined,
});

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || !Array.isArray(parsed.productions)) return emptyData();
    return {
      productions: parsed.productions,
      scanLog: Array.isArray(parsed.scanLog) ? parsed.scanLog : [],
      activeProductionId: parsed.activeProductionId ?? null,
      productionVersions:
        parsed.productionVersions && typeof parsed.productionVersions === "object" && !Array.isArray(parsed.productionVersions)
          ? (parsed.productionVersions as Record<string, number>)
          : undefined,
    };
  } catch {
    return emptyData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getProduction(data: AppData, id: string): Production | undefined {
  return data.productions.find((p) => p.id === id);
}

export function findItemByQr(
  production: Production,
  raw: string
): InventoryItem | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  try {
    const j = JSON.parse(trimmed) as { id?: string };
    if (j && typeof j.id === "string") {
      const byId = production.items.find((i) => i.id === j.id);
      if (byId) return byId;
    }
  } catch {
    // not JSON
  }

  const lower = trimmed.toLowerCase();
  return production.items.find((item) =>
    item.qrAliases.some((a) => {
      const t = a.trim();
      if (!t) return false;
      return t === trimmed || t.toLowerCase() === lower;
    })
  );
}

export function lastScanForItem(
  log: ScanLogEntry[],
  productionId: string,
  itemId: string
): ScanLogEntry | undefined {
  const relevant = log
    .filter((e) => e.productionId === productionId && e.itemId === itemId)
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  return relevant[0];
}

export function exportInventoryCsv(production: Production, log: ScanLogEntry[]): string {
  const headers = [
    "Item ID",
    "Kind",
    "Name",
    "Size",
    "Status",
    "QR aliases",
    "Handwritten / sticker IDs",
    "Last location",
    "Last scan (local)",
    "Notes",
  ];
  const lines = [headers.join(",")];
  const prodLog = log.filter((e) => e.productionId === production.id);

  for (const item of production.items) {
    const last = lastScanForItem(prodLog, production.id, item.id);
    const row = [
      item.id,
      item.kind,
      item.name,
      item.size ? `"${item.size.replace(/"/g, '""')}"` : "",
      effectiveItemCondition(item),
      `"${item.qrAliases.map((a) => a.replace(/"/g, '""')).join(" | ")}"`,
      `"${getHandwrittenMarks(item).map((a) => a.replace(/"/g, '""')).join(" | ")}"`,
      last ? `"${last.locationLabel.replace(/"/g, '""')} (${last.locationKind})"` : "",
      last ? `"${formatLocalDateTime(last.scannedAt)}"` : "",
      item.notes ? `"${item.notes.replace(/"/g, '""')}"` : "",
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export function exportScanLogCsv(production: Production, log: ScanLogEntry[]): string {
  const filtered = log
    .filter((e) => e.productionId === production.id)
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  const headers = [
    "Rental house",
    "Date & time (local)",
    "Item kind",
    "Item name",
    "Size",
    "Rental sticker IDs",
    "QR aliases",
    "Location",
    "Location type",
    "Scan method",
    "Raw scan text",
  ];
  const lines = [headers.join(",")];
  for (const e of filtered) {
    const item = production.items.find((i) => i.id === e.itemId);
    const size = item?.size ?? "";
    const stickerIds = item ? getHandwrittenMarks(item).join(" | ") : "";
    const aliases = item ? item.qrAliases.join(" | ") : "";
    lines.push(
      [
        `"${(production.rentalHouseName ?? "").replace(/"/g, '""')}"`,
        `"${formatLocalDateTime(e.scannedAt)}"`,
        e.itemKind,
        `"${e.itemName.replace(/"/g, '""')}"`,
        `"${size.replace(/"/g, '""')}"`,
        `"${stickerIds.replace(/"/g, '""')}"`,
        `"${aliases.replace(/"/g, '""')}"`,
        `"${e.locationLabel.replace(/"/g, '""')}"`,
        e.locationKind,
        (e.scanMethod ? SCAN_METHOD_LABEL[e.scanMethod] : "Dynamic QR").replace(/"/g, '""'),
        `"${e.rawQr.replace(/"/g, '""')}"`,
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function formatLocalDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
