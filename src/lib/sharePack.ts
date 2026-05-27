import type { ItemCondition, ItemKind, LocationKind, Production } from "@/types";
import { effectiveItemCondition } from "@/types";

export const SHARE_PACK_MAGIC = "fabricFloCrewShare";
export const SHARE_PACK_VERSION = 1 as const;

export type CrewSharePackV1 = {
  kind: typeof SHARE_PACK_MAGIC;
  version: typeof SHARE_PACK_VERSION;
  exportedAt: string;
  productionName: string;
  sourceProductionId?: string;
  items: Array<{
    kind: ItemKind;
    name: string;
    qrAliases: string[];
    size?: string;
    notes?: string;
    condition?: ItemCondition;
  }>;
  locations: Array<{ kind: LocationKind; name: string }>;
};

export function buildCrewSharePack(production: Production): string {
  const payload: CrewSharePackV1 = {
    kind: SHARE_PACK_MAGIC,
    version: SHARE_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    productionName: production.name,
    sourceProductionId: production.id,
    items: production.items.map((i) => ({
      kind: i.kind,
      name: i.name,
      qrAliases: [...i.qrAliases],
      size: i.size,
      notes: i.notes,
      condition: effectiveItemCondition(i),
    })),
    locations: production.locations.map((l) => ({ kind: l.kind, name: l.name })),
  };
  return JSON.stringify(payload);
}

export function parseCrewSharePack(json: string): CrewSharePackV1 | null {
  try {
    const o = JSON.parse(json) as CrewSharePackV1;
    if (!o || o.kind !== SHARE_PACK_MAGIC || o.version !== SHARE_PACK_VERSION) return null;
    if (typeof o.productionName !== "string" || !o.productionName.trim()) return null;
    if (!Array.isArray(o.items) || !Array.isArray(o.locations)) return null;
    for (const it of o.items) {
      if (!it || (it.kind !== "fabric" && it.kind !== "bag")) return null;
      if (typeof it.name !== "string") return null;
      if (!Array.isArray(it.qrAliases)) return null;
    }
    for (const loc of o.locations) {
      if (!loc || !loc.name?.trim()) return null;
      if (loc.kind !== "studio" && loc.kind !== "filming_location" && loc.kind !== "transport_truck")
        return null;
    }
    return o;
  } catch {
    return null;
  }
}
