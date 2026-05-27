import type { Production } from "@/types";
import { fabricFloCreateProduction, isNormalizedFabricFloBackend } from "@/lib/cloudRepository";

type EnsureArgs = {
  name: string;
  productions: Production[];
  activeProductionId: string | null;
  session: { user: { id: string } } | null;
  addProduction: (name: string, opts?: { id?: string }) => string;
  setActiveProductionId: (id: string | null) => void;
};

/** Create or select a production by name. Returns production id, or null if none available. */
export async function ensureProductionByName({
  name,
  productions,
  activeProductionId,
  session,
  addProduction,
  setActiveProductionId,
}: EnsureArgs): Promise<string | null> {
  const n = name.trim();

  if (!n) {
    if (productions.length === 0) return null;
    const active = activeProductionId
      ? productions.find((p) => p.id === activeProductionId)
      : productions[0];
    const id = active?.id ?? productions[0]!.id;
    setActiveProductionId(id);
    return id;
  }

  const existing = productions.find((p) => p.name.trim().toLowerCase() === n.toLowerCase());
  if (existing) {
    setActiveProductionId(existing.id);
    return existing.id;
  }

  if (isNormalizedFabricFloBackend() && session) {
    const id = await fabricFloCreateProduction(n);
    return addProduction(n, { id });
  }
  return addProduction(n);
}
