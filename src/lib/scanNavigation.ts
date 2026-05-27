import type { ScanMethod } from "@/types";

/** Router state for /inventory after a scan. */
export type InventoryNavState = {
  raw?: string;
  scanMethod?: ScanMethod;
  lockedLocationId?: string;
  lockedLocationLabel?: string;
};

/** Router state for /assign after a scan. */
export type AssignNavState = {
  raw?: string;
  scanMethod?: ScanMethod;
  lockedLocationId?: string;
  lockedLocationLabel?: string;
};

/** Router state for /scan when continuing at the same place. */
export type ScanNavState = {
  lockedLocationId?: string;
  lockedLocationLabel?: string;
};

/** Router state for /log after saving a scan. */
export type LogNavState = {
  flash?: { itemName: string; locationLabel: string };
  lockedLocationId?: string;
  lockedLocationLabel?: string;
};

export function readInventoryNavState(state: unknown): InventoryNavState {
  if (!state || typeof state !== "object") return {};
  const s = state as InventoryNavState;
  return {
    raw: typeof s.raw === "string" ? s.raw : undefined,
    scanMethod: s.scanMethod,
    lockedLocationId: typeof s.lockedLocationId === "string" ? s.lockedLocationId : undefined,
    lockedLocationLabel:
      typeof s.lockedLocationLabel === "string" ? s.lockedLocationLabel : undefined,
  };
}

export function readAssignNavState(state: unknown): AssignNavState {
  if (!state || typeof state !== "object") return {};
  const s = state as AssignNavState;
  return {
    raw: typeof s.raw === "string" ? s.raw : undefined,
    scanMethod: s.scanMethod,
    lockedLocationId: typeof s.lockedLocationId === "string" ? s.lockedLocationId : undefined,
    lockedLocationLabel:
      typeof s.lockedLocationLabel === "string" ? s.lockedLocationLabel : undefined,
  };
}

export function readScanNavState(state: unknown): ScanNavState {
  if (!state || typeof state !== "object") return {};
  const s = state as ScanNavState;
  return {
    lockedLocationId: typeof s.lockedLocationId === "string" ? s.lockedLocationId : undefined,
    lockedLocationLabel:
      typeof s.lockedLocationLabel === "string" ? s.lockedLocationLabel : undefined,
  };
}

export function readLogNavState(state: unknown): LogNavState {
  if (!state || typeof state !== "object") return {};
  const s = state as LogNavState;
  return {
    flash: s.flash,
    lockedLocationId: typeof s.lockedLocationId === "string" ? s.lockedLocationId : undefined,
    lockedLocationLabel:
      typeof s.lockedLocationLabel === "string" ? s.lockedLocationLabel : undefined,
  };
}
