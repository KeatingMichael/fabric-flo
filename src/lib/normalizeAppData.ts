import type {
  AppData,
  InventoryItem,
  InviteRecipient,
  ItemKind,
  LocationKind,
  NamedLocation,
  Production,
  ProductionMemberRole,
  ScanLogEntry,
} from "@/types";
import { isProductionMemberRole } from "@/lib/productionPermissions";
import { withDynamicTrackingAlias } from "@/lib/qrPayload";

function isItemKind(x: unknown): x is ItemKind {
  return x === "fabric" || x === "bag";
}

function isLocationKind(x: unknown): x is LocationKind {
  return x === "studio" || x === "filming_location" || x === "transport_truck";
}

function normalizeItem(raw: unknown): InventoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<InventoryItem>;
  if (typeof o.id !== "string" || !isItemKind(o.kind) || typeof o.name !== "string") return null;
  const qrAliases = Array.isArray(o.qrAliases)
    ? o.qrAliases.filter((a): a is string => typeof a === "string")
    : [];
  const condition =
    o.condition === "lost" || o.condition === "damaged" || o.condition === "ok"
      ? o.condition
      : undefined;
  return withDynamicTrackingAlias({
    id: o.id,
    kind: o.kind,
    name: o.name,
    qrAliases,
    size: typeof o.size === "string" && o.size.trim() ? o.size.trim() : undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    condition,
  });
}

function normalizeLocation(raw: unknown): NamedLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<NamedLocation>;
  if (typeof o.id !== "string" || !isLocationKind(o.kind) || typeof o.name !== "string") return null;
  return { id: o.id, kind: o.kind, name: o.name };
}

function normalizeProduction(raw: unknown): Production | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<Production>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const createdAt =
    typeof o.createdAt === "string" && o.createdAt.trim() !== ""
      ? o.createdAt
      : new Date().toISOString();
  const items = Array.isArray(o.items)
    ? (o.items.map(normalizeItem).filter(Boolean) as InventoryItem[])
    : [];
  const locations = Array.isArray(o.locations)
    ? (o.locations.map(normalizeLocation).filter(Boolean) as NamedLocation[])
    : [];
  const departmentHeadPin =
    typeof o.departmentHeadPin === "string" && o.departmentHeadPin.trim()
      ? o.departmentHeadPin.trim()
      : undefined;
  const rentalHouseNameRaw = (o as { rentalHouseName?: unknown }).rentalHouseName;
  const rentalHouseName =
    typeof rentalHouseNameRaw === "string" && rentalHouseNameRaw.trim() ? rentalHouseNameRaw.trim() : undefined;
  const inviteRecipients = Array.isArray(o.inviteRecipients)
    ? (o.inviteRecipients
        .map((r) => {
          if (!r || typeof r !== "object") return null;
          const row = r as { id?: string; contact?: string; kind?: string };
          if (typeof row.id !== "string" || typeof row.contact !== "string") return null;
          const kind = row.kind === "phone" ? "phone" : row.kind === "email" ? "email" : null;
          if (!kind) return null;
          return { id: row.id, contact: row.contact.trim(), kind } satisfies InviteRecipient;
        })
        .filter(Boolean) as InviteRecipient[])
    : undefined;
  return {
    id: o.id,
    name: o.name,
    rentalHouseName,
    items,
    locations,
    createdAt,
    departmentHeadPin,
    inviteRecipients: inviteRecipients?.length ? inviteRecipients : undefined,
  };
}

function normalizeScanLogEntry(raw: unknown): ScanLogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Partial<ScanLogEntry>;
  if (
    typeof e.id !== "string" ||
    typeof e.productionId !== "string" ||
    typeof e.itemId !== "string" ||
    !isItemKind(e.itemKind) ||
    typeof e.itemName !== "string" ||
    typeof e.locationId !== "string" ||
    !isLocationKind(e.locationKind) ||
    typeof e.locationLabel !== "string" ||
    typeof e.scannedAt !== "string" ||
    typeof e.rawQr !== "string"
  ) {
    return null;
  }
  const idempotencyKey =
    typeof e.idempotencyKey === "string" && e.idempotencyKey.trim()
      ? e.idempotencyKey.trim()
      : e.id;
  const scanMethod =
    e.scanMethod === "qr" || e.scanMethod === "label" || e.scanMethod === "manual"
      ? e.scanMethod
      : undefined;
  return {
    id: e.id,
    productionId: e.productionId,
    itemId: e.itemId,
    itemKind: e.itemKind,
    itemName: e.itemName,
    locationId: e.locationId,
    locationKind: e.locationKind,
    locationLabel: e.locationLabel,
    scannedAt: e.scannedAt,
    rawQr: e.rawQr,
    idempotencyKey,
    scanMethod,
  };
}

function parseProductionVersions(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && /^\d+$/.test(v)) out[k] = Number.parseInt(v, 10);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Validates and normalizes unknown JSON (e.g. from Supabase) into app state. */
export function normalizeAppData(input: unknown): AppData {
  const empty: AppData = { productions: [], scanLog: [], activeProductionId: null };
  if (!input || typeof input !== "object") return empty;
  const o = input as Partial<AppData> & { versions?: unknown };
  const productions = Array.isArray(o.productions)
    ? (o.productions.map(normalizeProduction).filter(Boolean) as Production[])
    : [];
  const scanLog = Array.isArray(o.scanLog)
    ? (o.scanLog.map(normalizeScanLogEntry).filter(Boolean) as ScanLogEntry[])
    : [];
  const activeProductionId =
    typeof o.activeProductionId === "string" &&
    productions.some((p) => p.id === o.activeProductionId)
      ? o.activeProductionId
      : productions[0]?.id ?? null;
  const productionVersions = parseProductionVersions(o.versions);
  const productionRoles =
    o.productionRoles && typeof o.productionRoles === "object" && !Array.isArray(o.productionRoles)
      ? Object.fromEntries(
          Object.entries(o.productionRoles as Record<string, unknown>).filter((entry): entry is [
            string,
            ProductionMemberRole,
          ] => isProductionMemberRole(String(entry[1])))
        )
      : undefined;
  return { productions, scanLog, activeProductionId, productionVersions, productionRoles };
}
