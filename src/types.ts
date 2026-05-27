export type LocationKind = "studio" | "filming_location" | "transport_truck";

export type ItemKind = "fabric" | "bag";

/** Rental health — default `ok` for items saved before this field existed. */
export type ItemCondition = "ok" | "lost" | "damaged";

/** How the piece was identified at scan time. */
export type ScanMethod = "qr" | "label" | "manual";

export interface NamedLocation {
  id: string;
  kind: LocationKind;
  name: string;
}

export interface InventoryItem {
  id: string;
  kind: ItemKind;
  name: string;
  /** Values that count as this item when scanned (supports rotated / dynamic QR payloads). */
  qrAliases: string[];
  /** e.g. 20'-0" x 20'-0" */
  size?: string;
  notes?: string;
  /** Omitted in older data — treat as `"ok"`. */
  condition?: ItemCondition;
}

export type InviteRecipient = {
  id: string;
  contact: string;
  kind: "email" | "phone";
};

export interface Production {
  id: string;
  name: string;
  /** Optional rental house name for exports/log context. */
  rentalHouseName?: string;
  locations: NamedLocation[];
  items: InventoryItem[];
  createdAt: string;
  /**
   * Optional PIN for department heads (legacy). Stored on this device only.
   */
  departmentHeadPin?: string;
  /** Crew contacts to share Invite Codes with (device-local list). */
  inviteRecipients?: InviteRecipient[];
}

export interface ScanLogEntry {
  id: string;
  productionId: string;
  itemId: string;
  itemKind: ItemKind;
  itemName: string;
  locationId: string;
  locationKind: LocationKind;
  locationLabel: string;
  scannedAt: string;
  rawQr: string;
  /** Stable key for server de-duplication on retry (defaults to scan `id`). */
  idempotencyKey?: string;
  /** Defaults to `qr` when omitted (older log rows). */
  scanMethod?: ScanMethod;
}

export type ProductionMemberRole = "admin" | "department_head" | "crew" | "viewer";

export interface AppData {
  productions: Production[];
  scanLog: ScanLogEntry[];
  activeProductionId: string | null;
  /** Server `productions.version` map when using normalized Supabase backend (`fabric_flo_pull` / `fabric_flo_push`). */
  productionVersions?: Record<string, number>;
  /** Caller's role per production when signed in with cloud (from `production_members`). */
  productionRoles?: Record<string, ProductionMemberRole>;
}

export const LOCATION_KIND_LABEL: Record<LocationKind, string> = {
  studio: "Studio",
  filming_location: "Filming location",
  transport_truck: "Transport truck",
};

export const LOCATION_KIND_ORDER: LocationKind[] = [
  "studio",
  "filming_location",
  "transport_truck",
];

export const ITEM_CONDITION_LABEL: Record<ItemCondition, string> = {
  ok: "In use",
  lost: "Lost",
  damaged: "Damaged",
};

export function effectiveItemCondition(item: Pick<InventoryItem, "condition">): ItemCondition {
  return item.condition === "lost" || item.condition === "damaged" ? item.condition : "ok";
}
