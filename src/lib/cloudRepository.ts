import type { AppData, ProductionMemberRole } from "@/types";
import { isProductionMemberRole } from "@/lib/productionPermissions";
import type { ParsedImportRow } from "@/lib/inventoryImport";
import { getSupabase } from "@/lib/supabase";
import { normalizeAppData } from "@/lib/normalizeAppData";

export type FabricFloInviteRole = "viewer" | "crew" | "department_head";

export type FabricFloCreateInviteResult = {
  inviteId: string;
  token: string;
  expiresAt: string;
  role: FabricFloInviteRole;
};

export type FabricFloImportResult = {
  merged: number;
  added: number;
  version: number;
};

export function isNormalizedFabricFloBackend(): boolean {
  return import.meta.env.VITE_FABRIC_FLO_BACKEND === "normalized";
}

export async function fetchUserAppState(userId: string): Promise<AppData | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("user_app_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.state) return null;
  const normalized = normalizeAppData(data.state);
  if (!normalized.productions.length && !normalized.scanLog.length) return null;
  return normalized;
}

export async function upsertUserAppState(userId: string, state: AppData): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const payload = {
    user_id: userId,
    state,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("user_app_state").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

export function buildFabricFloPushArgs(app: AppData): {
  state: Omit<AppData, "productionVersions">;
  expectedVersions: Record<string, number>;
} {
  const { productionVersions, ...state } = app;
  const expectedVersions: Record<string, number> = {};
  if (productionVersions) {
    for (const p of state.productions) {
      const v = productionVersions[p.id];
      if (typeof v === "number" && Number.isFinite(v)) expectedVersions[p.id] = v;
    }
  }
  return { state, expectedVersions };
}

export async function fabricFloPull(): Promise<unknown> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { data, error } = await sb.rpc("fabric_flo_pull");
  if (error) throw error;
  return data;
}

export async function fabricFloCreateProduction(name: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { data, error } = await sb.rpc("fabric_flo_create_production", { p_name: name });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("Unexpected response from fabric_flo_create_production.");
  return data;
}

export async function fabricFloPush(app: AppData): Promise<Record<string, number>> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { state, expectedVersions } = buildFabricFloPushArgs(app);
  const { data, error } = await sb.rpc("fabric_flo_push", {
    p_state: state,
    p_expected_versions: expectedVersions,
  });
  if (error) throw error;
  const versions = (data as { versions?: unknown })?.versions;
  if (!versions || typeof versions !== "object" || Array.isArray(versions)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(versions as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && /^\d+$/.test(v)) out[k] = Number.parseInt(v, 10);
  }
  return out;
}

export function isVersionConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "P0001" || (typeof e.message === "string" && e.message.includes("version_conflict"));
}

export async function fabricFloFetchAppData(): Promise<AppData> {
  const raw = await fabricFloPull();
  const app = normalizeAppData(raw);
  if (isNormalizedFabricFloBackend()) {
    try {
      const productionRoles = await fetchMyProductionRoles();
      return { ...app, productionRoles };
    } catch {
      return app;
    }
  }
  return app;
}

/** Current user's role on each production (normalized cloud). */
export async function fetchMyProductionRoles(): Promise<Record<string, ProductionMemberRole>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.from("production_members").select("production_id, role");
  if (error) throw error;
  const out: Record<string, ProductionMemberRole> = {};
  for (const row of data ?? []) {
    const id = row.production_id as string;
    const role = row.role as string;
    if (id && isProductionMemberRole(role)) out[id] = role;
  }
  return out;
}

function importRowsToJson(rows: ParsedImportRow[]): unknown[] {
  return rows.map((r) => ({
    id: r.id ?? null,
    kind: r.kind,
    name: r.name,
    qrAliases: r.qrAliases,
    size: r.size ?? null,
    notes: r.notes ?? null,
    condition: r.condition ?? null,
  }));
}

export async function fabricFloImportInventoryRows(
  productionId: string,
  rows: ParsedImportRow[],
  expectedVersion?: number
): Promise<FabricFloImportResult> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { data, error } = await sb.rpc("fabric_flo_import_inventory_rows", {
    p_production_id: productionId,
    p_rows: importRowsToJson(rows),
    p_expected_version: expectedVersion ?? null,
  });
  if (error) throw error;
  const d = data as { merged?: number; added?: number; version?: number };
  return {
    merged: typeof d.merged === "number" ? d.merged : 0,
    added: typeof d.added === "number" ? d.added : 0,
    version: typeof d.version === "number" ? d.version : 0,
  };
}

export async function fabricFloCreateInvite(
  productionId: string,
  role: FabricFloInviteRole,
  email?: string,
  expiresDays = 7
): Promise<FabricFloCreateInviteResult> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { data, error } = await sb.rpc("fabric_flo_create_invite", {
    p_production_id: productionId,
    p_role: role,
    p_email: email?.trim() || null,
    p_expires_days: expiresDays,
  });
  if (error) throw error;
  const d = data as {
    inviteId?: string;
    token?: string;
    expiresAt?: string;
    role?: FabricFloInviteRole;
  };
  if (!d.token || !d.inviteId) throw new Error("Unexpected invite response.");
  return {
    inviteId: d.inviteId,
    token: d.token,
    expiresAt: d.expiresAt ?? "",
    role: d.role ?? role,
  };
}

export async function fabricFloAcceptInvite(token: string): Promise<{
  productionId: string;
  role: string;
}> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { data, error } = await sb.rpc("fabric_flo_accept_invite", { p_token: token.trim() });
  if (error) throw error;
  const d = data as { productionId?: string; role?: string };
  if (!d.productionId) throw new Error("Unexpected accept-invite response.");
  return { productionId: d.productionId, role: d.role ?? "crew" };
}

export type FabricFloDeleteAccountResult = {
  deletedProductions: number;
  removedMemberships: number;
};

/** Removes caller's cloud memberships and sole-admin productions (see Privacy Policy). */
export async function fabricFloDeleteMyAccount(): Promise<FabricFloDeleteAccountResult> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  if (!isNormalizedFabricFloBackend()) {
    const { data: session } = await sb.auth.getSession();
    const uid = session.session?.user?.id;
    if (uid) {
      await sb.from("user_app_state").delete().eq("user_id", uid);
    }
    return { deletedProductions: 0, removedMemberships: 0 };
  }
  const { data, error } = await sb.rpc("fabric_flo_delete_my_account");
  if (error) throw error;
  const d = data as { deletedProductions?: number; removedMemberships?: number };
  return {
    deletedProductions: typeof d.deletedProductions === "number" ? d.deletedProductions : 0,
    removedMemberships: typeof d.removedMemberships === "number" ? d.removedMemberships : 0,
  };
}
