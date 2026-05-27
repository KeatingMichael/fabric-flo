import { v4 as uuid } from "uuid";
import type { InventoryItem } from "@/types";

/** Stable payload for printed labels; does not change when you rotate dynamic codes. */
export function fabricFloLabelPayload(
  item: Pick<InventoryItem, "id" | "kind" | "name" | "size">
): string {
  const payload: Record<string, string> = {
    ff: "1",
    id: item.id,
    t: item.kind,
    n: item.name,
  };
  if (item.size?.trim()) payload.s = item.size.trim();
  return JSON.stringify(payload);
}

/** One-time rotatable code; store the full JSON string in `qrAliases`. */
export function fabricFloDynamicPayload(
  item: Pick<InventoryItem, "id" | "kind" | "name" | "size">
): string {
  const payload: Record<string, string> = {
    ff: "1",
    id: item.id,
    dyn: uuid().replace(/-/g, "").slice(0, 12),
    t: item.kind,
    n: item.name,
  };
  if (item.size?.trim()) payload.s = item.size.trim();
  return JSON.stringify(payload);
}

/** True when the payload is a rotatable Fabric Flo tracking code (includes `dyn`). */
export function isDynamicTrackingPayload(raw: string): boolean {
  const p = parseFabricFloPayload(raw);
  return Boolean(p?.id && p.dyn);
}

/** Ensures at least one dynamic tracking code exists on the item. */
export function withDynamicTrackingAlias(item: InventoryItem): InventoryItem {
  if (item.qrAliases.some(isDynamicTrackingPayload)) {
    return item;
  }
  const dyn = fabricFloDynamicPayload(item);
  return {
    ...item,
    qrAliases: [...new Set([...item.qrAliases, dyn])],
  };
}

export function parseFabricFloPayload(
  raw: string
): { id?: string; kind?: string; name?: string; dyn?: string } | null {
  try {
    const j = JSON.parse(raw.trim()) as Record<string, unknown>;
    if (!j || j.ff !== "1") return null;
    return {
      id: typeof j.id === "string" ? j.id : undefined,
      kind: typeof j.t === "string" ? j.t : undefined,
      name: typeof j.n === "string" ? j.n : undefined,
      dyn: typeof j.dyn === "string" ? j.dyn : undefined,
    };
  } catch {
    return null;
  }
}
