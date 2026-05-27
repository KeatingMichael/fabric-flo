import { FABRIC_TYPE_CATALOG } from "@/data/fabricTypeCatalog";
import type { InventoryItem, ItemKind } from "@/types";

/** Distinct item names already on this production for the given kind (for name pickers). */
export function uniqueItemNamesForKind(
  items: InventoryItem[],
  kind: ItemKind
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (item.kind !== kind) continue;
    const n = item.name.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * Fabric Flow catalog (top-to-bottom) for rental piece pickers, then custom names on this production.
 */
export function inventoryNameOptionsForKind(
  items: InventoryItem[],
  _kind: ItemKind
): string[] {
  const fromProduction = uniqueItemNamesForKind(items, "fabric").concat(
    uniqueItemNamesForKind(items, "bag")
  );
  if (FABRIC_TYPE_CATALOG.length === 0) {
    return [...new Set(fromProduction)];
  }

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of FABRIC_TYPE_CATALOG) {
    if (!raw) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }

  for (const name of fromProduction) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }

  return out;
}

/** Groups items that share the same kind, name, and size (one rental SKU, many physical pieces). */
export function inventoryPieceGroupKey(
  item: Pick<InventoryItem, "kind" | "name" | "size">
): string {
  return [
    item.kind,
    item.name.trim().toLowerCase(),
    (item.size ?? "").trim().toLowerCase(),
  ].join("\0");
}

/**
 * When several list rows share name + size, label each physical piece (e.g. "Piece 2 of 6").
 * Order follows the production item list.
 */
export function getInventoryPieceLabel(
  item: InventoryItem,
  allItems: InventoryItem[]
): string | null {
  const key = inventoryPieceGroupKey(item);
  const group = allItems.filter((i) => inventoryPieceGroupKey(i) === key);
  if (group.length <= 1) return null;
  const index = group.findIndex((i) => i.id === item.id);
  if (index < 0) return null;
  return `Piece ${index + 1} of ${group.length}`;
}
