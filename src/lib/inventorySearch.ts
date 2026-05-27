import { getHandwrittenMarks, normalizeLabelText } from "@/lib/labelText";
import { getInventoryPieceLabel } from "@/lib/inventoryPieces";
import type { InventoryItem, ItemKind } from "@/types";

export type InventoryKindFilter = "all" | ItemKind;

function searchTokens(query: string): string[] {
  return normalizeLabelText(query)
    .split(/[\s,;/|]+/)
    .filter((t) => t.length > 0);
}

function itemSearchBlob(item: InventoryItem, allItems: InventoryItem[]): string {
  return normalizeLabelText(
    [
      item.name,
      item.size ?? "",
      item.notes ?? "",
      item.kind,
      item.id,
      getInventoryPieceLabel(item, allItems) ?? "",
      ...getHandwrittenMarks(item),
    ].join(" ")
  );
}

export function matchesInventorySearch(
  item: InventoryItem,
  query: string,
  allItems: InventoryItem[]
): boolean {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  const blob = itemSearchBlob(item, allItems);
  return tokens.every((t) => blob.includes(t));
}

export function filterInventoryItems(
  items: InventoryItem[],
  query: string,
  kindFilter: InventoryKindFilter
): InventoryItem[] {
  return items.filter((item) => {
    if (kindFilter !== "all" && item.kind !== kindFilter) return false;
    return matchesInventorySearch(item, query, items);
  });
}
