import type { LocationKind, NamedLocation } from "@/types";

export type BulkLocationPreset = {
  id: string;
  label: string;
  kind: LocationKind;
  prefix: string;
  start: number;
  count: number;
};

export const BULK_LOCATION_PRESETS: BulkLocationPreset[] = [
  { id: "stages-6", label: "Stages 1–6", kind: "studio", prefix: "Stage ", start: 1, count: 6 },
  { id: "trucks-4", label: "Trucks 1–4", kind: "transport_truck", prefix: "Truck ", start: 1, count: 4 },
  {
    id: "sets-6",
    label: "Sets 1–6",
    kind: "filming_location",
    prefix: "Set ",
    start: 1,
    count: 6,
  },
];

export function generateBulkLocationNames(prefix: string, start: number, count: number): string[] {
  const p = prefix.trim();
  const n = Math.max(0, Math.min(count, 50));
  const from = Math.max(1, start);
  return Array.from({ length: n }, (_, i) => `${p}${from + i}`.trim()).filter(Boolean);
}

export function namesNotYetOnProduction(
  names: string[],
  existing: NamedLocation[]
): { toAdd: string[]; skipped: string[] } {
  const existingKeys = new Set(existing.map((l) => l.name.trim().toLowerCase()));
  const toAdd: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (existingKeys.has(key)) {
      skipped.push(name);
    } else {
      toAdd.push(name.trim());
    }
  }
  return { toAdd, skipped };
}
