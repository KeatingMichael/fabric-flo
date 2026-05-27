import type { InventoryItem, Production, ScanMethod } from "@/types";
import { findItemByQr } from "@/lib/storage";
import { parseFabricFloPayload } from "@/lib/qrPayload";
import { bestLabelMatch, rankLabelMatches, type LabelMatch } from "@/lib/labelText";

export function detectScanMethod(raw: string, hint?: ScanMethod): ScanMethod {
  if (hint && hint !== "manual") return hint;
  const t = raw.trim();
  if (!t) return "manual";
  if (parseFabricFloPayload(t)) return "qr";
  return hint ?? "label";
}

export type ScanResolveResult = {
  item: InventoryItem | undefined;
  method: ScanMethod;
  labelMatches: LabelMatch[];
};

/**
 * Resolve a scan to an inventory row: dynamic QR / JSON first, then handwritten label text.
 */
export function resolveScan(
  production: Production,
  raw: string,
  methodHint?: ScanMethod
): ScanResolveResult {
  const trimmed = raw.trim();
  const method = detectScanMethod(trimmed, methodHint);
  const byQr = findItemByQr(production, trimmed);
  if (byQr) {
    return { item: byQr, method: parseFabricFloPayload(trimmed) ? "qr" : method, labelMatches: [] };
  }
  if (method === "qr") {
    return { item: undefined, method, labelMatches: [] };
  }
  const labelMatches = rankLabelMatches(production, trimmed, 5);
  const top = labelMatches[0];
  const item = top && top.score >= 88 ? top.item : bestLabelMatch(production, trimmed)?.item;
  return { item, method, labelMatches };
}

export const SCAN_METHOD_LABEL: Record<ScanMethod, string> = {
  qr: "Dynamic QR",
  label: "Handwritten label",
  manual: "Manual entry",
};
