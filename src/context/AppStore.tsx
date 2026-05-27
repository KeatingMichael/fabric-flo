import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import type {
  AppData,
  InventoryItem,
  ItemCondition,
  ItemKind,
  LocationKind,
  NamedLocation,
  Production,
  ScanLogEntry,
  ScanMethod,
} from "@/types";
import { parseFabricFloPayload } from "@/lib/qrPayload";
import {
  findItemByQr,
  getProduction,
  loadAppData,
  saveAppData,
} from "@/lib/storage";
import type { ParsedImportRow } from "@/lib/inventoryImport";
import type { ParsedScanLogRow } from "@/lib/scanLogImport";
import { fabricFloDynamicPayload, withDynamicTrackingAlias } from "@/lib/qrPayload";
import { normalizeAppData } from "@/lib/normalizeAppData";
import type { CrewSharePackV1 } from "@/lib/sharePack";

type Listener = () => void;

let memory: AppData = typeof window === "undefined" ? defaultServerData() : loadAppData();
const listeners = new Set<Listener>();

function defaultServerData(): AppData {
  return { productions: [], scanLog: [], activeProductionId: null, productionVersions: undefined };
}

function emit() {
  listeners.forEach((l) => l());
}

function setMemory(next: AppData) {
  memory = next;
  if (typeof window !== "undefined") saveAppData(next);
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AppData {
  return memory;
}

function getServerSnapshot(): AppData {
  return defaultServerData();
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const api = useMemo(() => createApi(), []);
  const value = useMemo(() => ({ ...data, ...api }), [data, api]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function createApi() {
  function mergeInventoryImportRowsImpl(
    productionId: string,
    rows: ParsedImportRow[]
  ): { merged: number; added: number } {
    const prod = getProduction(memory, productionId);
    if (!prod || rows.length === 0) return { merged: 0, added: 0 };
    let merged = 0;
    let added = 0;
    let nextItems = [...prod.items];
    for (const row of rows) {
      const rowId = row.id?.trim();
      const existingById = rowId ? nextItems.find((i) => i.id === rowId) : undefined;
      if (existingById) {
        merged++;
        const mergedAliases = [
          ...new Set([
            ...existingById.qrAliases,
            ...row.qrAliases.map((s) => s.trim()).filter(Boolean),
          ]),
        ];
        const notes = row.notes?.trim() || existingById.notes;
        const size = row.size?.trim() || existingById.size;
        let condition: ItemCondition | undefined = existingById.condition;
        if (row.condition === "lost" || row.condition === "damaged") condition = row.condition;
        else if (row.condition === "ok") condition = "ok";
        const cond: ItemCondition =
          condition === "lost" || condition === "damaged" ? condition : "ok";
        nextItems = nextItems.map((i) =>
          i.id === existingById.id
            ? withDynamicTrackingAlias({
                ...i,
                qrAliases: mergedAliases,
                notes,
                size,
                condition: cond,
              })
            : i
        );
      } else {
        added++;
        const item: InventoryItem = withDynamicTrackingAlias({
          id: uuid(),
          kind: row.kind,
          name: row.name.trim() || (row.kind === "fabric" ? "Fabric" : "Bag"),
          qrAliases: [...new Set(row.qrAliases.map((s) => s.trim()).filter(Boolean))],
          size: row.size?.trim() || undefined,
          notes: row.notes?.trim() || undefined,
          condition:
            row.condition === "lost" || row.condition === "damaged" ? row.condition : "ok",
        });
        nextItems.push(item);
      }
    }
    setMemory({
      ...memory,
      productions: memory.productions.map((p) =>
        p.id === productionId ? { ...p, items: nextItems } : p
      ),
    });
    return { merged, added };
  }

  function importScanLogRowsImpl(
    productionId: string,
    rows: ParsedScanLogRow[]
  ): { imported: number; skipped: number } {
    const prod = getProduction(memory, productionId);
    if (!prod || rows.length === 0) return { imported: 0, skipped: rows.length };

    let imported = 0;
    let skipped = 0;
    let locations = [...prod.locations];
    const newEntries: ScanLogEntry[] = [];

    for (const row of rows) {
      const item = prod.items.find(
        (i) =>
          i.kind === row.itemKind && i.name.trim().toLowerCase() === row.itemName.trim().toLowerCase()
      );
      if (!item) {
        skipped++;
        continue;
      }

      let loc = locations.find(
        (l) =>
          l.kind === row.locationKind &&
          l.name.trim().toLowerCase() === row.locationLabel.trim().toLowerCase()
      );
      if (!loc) {
        loc = { id: uuid(), kind: row.locationKind, name: row.locationLabel.trim() };
        locations = [...locations, loc];
      }

      const id = uuid();
      newEntries.push({
        id,
        productionId,
        itemId: item.id,
        itemKind: row.itemKind,
        itemName: row.itemName,
        locationId: loc.id,
        locationKind: row.locationKind,
        locationLabel: loc.name,
        scannedAt: row.scannedAt,
        rawQr: row.rawQr,
        idempotencyKey: id,
        scanMethod: row.scanMethod,
      });
      imported++;
    }

    if (imported === 0 && skipped === rows.length) {
      return { imported, skipped };
    }

    setMemory({
      ...memory,
      productions: memory.productions.map((p) =>
        p.id === productionId ? { ...p, locations } : p
      ),
      scanLog: [...newEntries, ...memory.scanLog],
    });
    return { imported, skipped };
  }

  function addItemsImpl(
    productionId: string,
    kind: ItemKind,
    name: string,
    qrAliases: string[],
    notes?: string,
    condition?: ItemCondition,
    size?: string,
    quantity = 1
  ): InventoryItem[] {
    const aliases = [...new Set(qrAliases.map((s) => s.trim()).filter(Boolean))];
    const cond: ItemCondition =
      condition === "lost" || condition === "damaged" ? condition : "ok";
    const count = Math.min(50, Math.max(1, Math.floor(quantity)));
    const created: InventoryItem[] = [];
    for (let n = 0; n < count; n++) {
      created.push(
        withDynamicTrackingAlias({
          id: uuid(),
          kind,
          name: name.trim() || (kind === "fabric" ? "Fabric" : "Bag"),
          qrAliases: aliases,
          size: size?.trim() || undefined,
          notes: notes?.trim() || undefined,
          condition: cond,
        })
      );
    }
    setMemory({
      ...memory,
      productions: memory.productions.map((p) =>
        p.id === productionId ? { ...p, items: [...p.items, ...created] } : p
      ),
    });
    return created;
  }

  return {
    setActiveProductionId(id: string | null) {
      setMemory({ ...memory, activeProductionId: id });
    },
    addProduction(name: string, opts?: { id?: string }) {
      const p: Production = {
        id: opts?.id ?? uuid(),
        name: name.trim(),
        locations: [],
        items: [],
        createdAt: new Date().toISOString(),
      };
      setMemory({
        ...memory,
        productions: [...memory.productions, p],
        activeProductionId: p.id,
      });
      return p.id;
    },
    mergeProductionVersions(versions: Record<string, number>) {
      if (!versions || Object.keys(versions).length === 0) return;
      setMemory({
        ...memory,
        productionVersions: { ...(memory.productionVersions ?? {}), ...versions },
      });
    },
    setProductionRoles(roles: Record<string, import("@/types").ProductionMemberRole>) {
      setMemory({ ...memory, productionRoles: roles });
    },
    renameProduction(productionId: string, name: string) {
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId ? { ...p, name: name.trim() || p.name } : p
        ),
      });
    },
    deleteProduction(productionId: string) {
      const productions = memory.productions.filter((p) => p.id !== productionId);
      const scanLog = memory.scanLog.filter((e) => e.productionId !== productionId);
      const activeProductionId =
        memory.activeProductionId === productionId
          ? productions[0]?.id ?? null
          : memory.activeProductionId;
      const productionRoles = { ...(memory.productionRoles ?? {}) };
      delete productionRoles[productionId];
      setMemory({
        ...memory,
        productions,
        scanLog,
        activeProductionId,
        productionRoles: Object.keys(productionRoles).length ? productionRoles : undefined,
      });
    },
    addLocation(productionId: string, kind: LocationKind, name: string) {
      const loc: NamedLocation = { id: uuid(), kind, name: name.trim() };
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId ? { ...p, locations: [...p.locations, loc] } : p
        ),
      });
      return loc.id;
    },
    addLocations(
      productionId: string,
      entries: { kind: LocationKind; name: string }[]
    ): number {
      const trimmed = entries
        .map((e) => ({ kind: e.kind, name: e.name.trim() }))
        .filter((e) => e.name.length > 0);
      if (!trimmed.length) return 0;
      const prod = getProduction(memory, productionId);
      if (!prod) return 0;
      const existing = new Set(prod.locations.map((l) => l.name.trim().toLowerCase()));
      const toCreate: NamedLocation[] = [];
      const seen = new Set<string>();
      for (const e of trimmed) {
        const key = e.name.toLowerCase();
        if (seen.has(key) || existing.has(key)) continue;
        seen.add(key);
        existing.add(key);
        toCreate.push({ id: uuid(), kind: e.kind, name: e.name });
      }
      if (!toCreate.length) return 0;
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId ? { ...p, locations: [...p.locations, ...toCreate] } : p
        ),
      });
      return toCreate.length;
    },
    removeLocation(productionId: string, locationId: string) {
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId
            ? { ...p, locations: p.locations.filter((l) => l.id !== locationId) }
            : p
        ),
      });
    },
    addItems(
      productionId: string,
      kind: ItemKind,
      name: string,
      qrAliases: string[],
      notes?: string,
      condition?: ItemCondition,
      size?: string,
      quantity = 1
    ) {
      return addItemsImpl(
        productionId,
        kind,
        name,
        qrAliases,
        notes,
        condition,
        size,
        quantity
      );
    },
    addItem(
      productionId: string,
      kind: ItemKind,
      name: string,
      qrAliases: string[],
      notes?: string,
      condition?: ItemCondition,
      size?: string
    ) {
      return addItemsImpl(productionId, kind, name, qrAliases, notes, condition, size, 1)[0]!;
    },
    updateItem(
      productionId: string,
      itemId: string,
      patch: Partial<Pick<InventoryItem, "name" | "qrAliases" | "notes" | "kind" | "condition" | "size">>
    ) {
      setMemory({
        ...memory,
        productions: memory.productions.map((p) => {
          if (p.id !== productionId) return p;
          return {
            ...p,
            items: p.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
          };
        }),
      });
    },
    removeItem(productionId: string, itemId: string) {
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p
        ),
        scanLog: memory.scanLog.filter(
          (e) => !(e.productionId === productionId && e.itemId === itemId)
        ),
      });
    },
    appendQrAlias(productionId: string, itemId: string, alias: string) {
      const a = alias.trim();
      if (!a) return;
      setMemory({
        ...memory,
        productions: memory.productions.map((p) => {
          if (p.id !== productionId) return p;
          return {
            ...p,
            items: p.items.map((i) => {
              if (i.id !== itemId) return i;
              const qrAliases = [...new Set([...i.qrAliases, a])];
              return { ...i, qrAliases };
            }),
          };
        }),
      });
    },
    /** Creates a new rotatable JSON QR payload, saves it on the item, and returns it for printing. */
    generateDynamicQrAlias(productionId: string, itemId: string): string {
      const prod = getProduction(memory, productionId);
      const item = prod?.items.find((i) => i.id === itemId);
      if (!item) return "";
      const payload = fabricFloDynamicPayload(item);
      const qrAliases = [...new Set([...item.qrAliases, payload])];
      setMemory({
        ...memory,
        productions: memory.productions.map((p) => {
          if (p.id !== productionId) return p;
          return {
            ...p,
            items: p.items.map((i) => (i.id === itemId ? { ...i, qrAliases } : i)),
          };
        }),
      });
      return payload;
    },
    logScan(
      entry: Omit<ScanLogEntry, "id" | "scannedAt" | "idempotencyKey" | "scanMethod"> & {
        scannedAt?: string;
        scanMethod?: ScanMethod;
      }
    ) {
      const id = uuid();
      const full: ScanLogEntry = {
        ...entry,
        id,
        scannedAt: entry.scannedAt ?? new Date().toISOString(),
        idempotencyKey: id,
        scanMethod: entry.scanMethod ?? (parseFabricFloPayload(entry.rawQr) ? "qr" : "label"),
      };
      setMemory({ ...memory, scanLog: [full, ...memory.scanLog] });
    },
    rememberHandwrittenMark(productionId: string, itemId: string, raw: string) {
      const t = raw.trim();
      if (!t || parseFabricFloPayload(t)) return;
      const prod = getProduction(memory, productionId);
      const item = prod?.items.find((i) => i.id === itemId);
      if (!item) return;
      const lower = t.toLowerCase();
      const has = item.qrAliases.some((a) => a.trim().toLowerCase() === lower);
      if (has) return;
      setMemory({
        ...memory,
        productions: memory.productions.map((p) => {
          if (p.id !== productionId) return p;
          return {
            ...p,
            items: p.items.map((i) => {
              if (i.id !== itemId) return i;
              return { ...i, qrAliases: [...i.qrAliases, t] };
            }),
          };
        }),
      });
    },
    linkUnknownScan(
      productionId: string,
      rawQr: string,
      kind: ItemKind,
      name: string,
      locationId: string
    ) {
      const prod = getProduction(memory, productionId);
      if (!prod) return;
      const loc = prod.locations.find((l) => l.id === locationId);
      if (!loc) return;
      const trimmed = rawQr.trim();
      const aliases: string[] = [];
      if (trimmed && !parseFabricFloPayload(trimmed)) aliases.push(trimmed);
      const base: InventoryItem = {
        id: uuid(),
        kind,
        name: name.trim() || (kind === "fabric" ? "Fabric" : "Bag"),
        qrAliases: aliases,
        condition: "ok",
      };
      const item = withDynamicTrackingAlias(base);
      const scanId = uuid();
      const entry: ScanLogEntry = {
        id: scanId,
        productionId,
        itemId: item.id,
        itemKind: item.kind,
        itemName: item.name,
        locationId: loc.id,
        locationKind: loc.kind,
        locationLabel: loc.name,
        scannedAt: new Date().toISOString(),
        rawQr: trimmed,
        idempotencyKey: scanId,
        scanMethod: parseFabricFloPayload(trimmed) ? "qr" : "label",
      };
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId ? { ...p, items: [...p.items, item] } : p
        ),
        scanLog: [entry, ...memory.scanLog],
      });
    },
    setDepartmentHeadPin(productionId: string, pin: string | null) {
      const trimmed = (pin ?? "").trim();
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId
            ? { ...p, departmentHeadPin: trimmed === "" ? undefined : trimmed }
            : p
        ),
      });
    },
    setRentalHouseName(productionId: string, name: string) {
      const trimmed = name.trim();
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId
            ? { ...p, rentalHouseName: trimmed === "" ? undefined : trimmed }
            : p
        ),
      });
    },
    addInviteRecipient(productionId: string, contact: string, kind: "email" | "phone") {
      const trimmed = contact.trim();
      if (!trimmed) return;
      const recipient = { id: uuid(), contact: trimmed, kind };
      setMemory({
        ...memory,
        productions: memory.productions.map((p) => {
          if (p.id !== productionId) return p;
          const list = p.inviteRecipients ?? [];
          const key = trimmed.toLowerCase();
          if (list.some((r) => r.contact.toLowerCase() === key)) return p;
          return { ...p, inviteRecipients: [...list, recipient] };
        }),
      });
    },
    removeInviteRecipient(productionId: string, recipientId: string) {
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId
            ? {
                ...p,
                inviteRecipients: (p.inviteRecipients ?? []).filter((r) => r.id !== recipientId),
              }
            : p
        ),
      });
    },
    mergeInventoryImportRows(productionId: string, rows: ParsedImportRow[]) {
      return mergeInventoryImportRowsImpl(productionId, rows);
    },
    importScanLogRows(productionId: string, rows: ParsedScanLogRow[]) {
      return importScanLogRowsImpl(productionId, rows);
    },
    importCrewSharePackAsNewProduction(payload: CrewSharePackV1, serverProductionId?: string) {
      const p: Production = {
        id: serverProductionId ?? uuid(),
        name: payload.productionName.trim(),
        locations: payload.locations.map((l) => ({
          id: uuid(),
          kind: l.kind,
          name: l.name.trim(),
        })),
        items: payload.items.map((row) =>
          withDynamicTrackingAlias({
            id: uuid(),
            kind: row.kind,
            name: row.name.trim() || (row.kind === "fabric" ? "Fabric" : "Bag"),
            qrAliases: [...new Set(row.qrAliases.map((s) => s.trim()).filter(Boolean))],
            size: row.size?.trim() || undefined,
            notes: row.notes?.trim() || undefined,
            condition:
              row.condition === "lost" || row.condition === "damaged" ? row.condition : "ok",
          })
        ),
        createdAt: new Date().toISOString(),
      };
      setMemory({
        ...memory,
        productions: [...memory.productions, p],
        activeProductionId: p.id,
      });
      return p.id;
    },
    importCrewSharePackMerge(productionId: string, payload: CrewSharePackV1) {
      const prod = getProduction(memory, productionId);
      if (!prod) return { merged: 0, added: 0, locationsAdded: 0 };
      let locations = [...prod.locations];
      let locationsAdded = 0;
      for (const loc of payload.locations) {
        const exists = locations.some(
          (l) =>
            l.kind === loc.kind &&
            l.name.trim().toLowerCase() === loc.name.trim().toLowerCase()
        );
        if (!exists) {
          locations.push({ id: uuid(), kind: loc.kind, name: loc.name.trim() });
          locationsAdded++;
        }
      }
      setMemory({
        ...memory,
        productions: memory.productions.map((p) =>
          p.id === productionId ? { ...p, locations } : p
        ),
      });
      const rows: ParsedImportRow[] = payload.items.map((i) => ({
        kind: i.kind,
        name: i.name,
        qrAliases: i.qrAliases,
        size: i.size,
        notes: i.notes,
        condition: i.condition,
      }));
      const { merged, added } = mergeInventoryImportRowsImpl(productionId, rows);
      return { merged, added, locationsAdded };
    },
    replaceEntireAppData(next: AppData) {
      setMemory(normalizeAppData(next));
    },
  };
}

type Ctx = AppData & ReturnType<typeof createApi>;

const AppContext = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside AppStoreProvider");
  return c;
}

export function useActiveProduction(): Production | null {
  const { productions, activeProductionId } = useApp();
  if (!activeProductionId) return null;
  return productions.find((p) => p.id === activeProductionId) ?? null;
}

export function useResolveScan(raw: string): {
  production: Production;
  item: InventoryItem | undefined;
} | null {
  const production = useActiveProduction();
  return useMemo(() => {
    if (!production || !raw.trim()) return null;
    return { production, item: findItemByQr(production, raw) };
  }, [production, raw]);
}

export function useScanLogForActive(): ScanLogEntry[] {
  const { scanLog, activeProductionId } = useApp();
  return useMemo(
    () =>
      activeProductionId
        ? scanLog.filter((e) => e.productionId === activeProductionId)
        : [],
    [scanLog, activeProductionId]
  );
}

/** Deep snapshot of persisted app state (for cloud sync). */
export function getAppSnapshot(): AppData {
  return structuredClone(memory);
}
