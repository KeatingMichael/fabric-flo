import { getAppSnapshot } from "@/context/AppStore";
import type { AppData } from "@/types";
import {
  fabricFloPush,
  isNormalizedFabricFloBackend,
  upsertUserAppState,
} from "@/lib/cloudRepository";

export type CloudPushResult = {
  productionVersions?: Record<string, number>;
};

/** Push local app state to Supabase (normalized or legacy blob). */
export async function pushAppStateToCloud(
  userId: string,
  data?: AppData
): Promise<CloudPushResult> {
  const snap = data ?? getAppSnapshot();
  if (isNormalizedFabricFloBackend()) {
    const vers = await fabricFloPush(snap);
    return { productionVersions: vers };
  }
  await upsertUserAppState(userId, snap);
  return {};
}
