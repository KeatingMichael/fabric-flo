import {
  fabricFloDeleteMyAccount,
  isNormalizedFabricFloBackend,
  type FabricFloDeleteAccountResult,
} from "@/lib/cloudRepository";
import { getSupabase } from "@/lib/supabase";

const EDGE_FN =
  (import.meta.env.VITE_ACCOUNT_DELETE_FUNCTION as string | undefined)?.trim() ||
  "delete-account";

function edgeEnabled(): boolean {
  const flag = (import.meta.env.VITE_ACCOUNT_DELETE_EDGE as string | undefined)?.trim();
  if (flag === "0" || flag === "false") return false;
  return isNormalizedFabricFloBackend();
}

function parseWipe(data: unknown): FabricFloDeleteAccountResult {
  const w =
    data && typeof data === "object" && "dataWiped" in data
      ? (data as { dataWiped?: FabricFloDeleteAccountResult }).dataWiped
      : data;
  const d = w as { deletedProductions?: number; removedMemberships?: number };
  return {
    deletedProductions: typeof d?.deletedProductions === "number" ? d.deletedProductions : 0,
    removedMemberships: typeof d?.removedMemberships === "number" ? d.removedMemberships : 0,
  };
}

/**
 * Wipes cloud production data; uses Edge Function for full auth.users removal when deployed.
 */
export async function deleteAccountAndData(): Promise<FabricFloDeleteAccountResult> {
  const sb = getSupabase();
  if (edgeEnabled() && sb) {
    try {
      const { data, error } = await sb.functions.invoke(EDGE_FN, { method: "POST" });
      if (!error && data && typeof data === "object" && "ok" in data && (data as { ok: boolean }).ok) {
        return parseWipe(data);
      }
      if (error) console.warn("Account delete Edge Function:", error.message);
    } catch (e) {
      console.warn("Edge Function unavailable, using RPC only:", e);
    }
  }
  return fabricFloDeleteMyAccount();
}
