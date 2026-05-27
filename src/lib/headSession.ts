const KEY = "fabric-flo-head-session";
const TTL_MS = 12 * 60 * 60 * 1000;

export type HeadSession = { productionId: string; exp: number; label?: string };

export function readHeadSession(): HeadSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as HeadSession;
    if (!j?.productionId || typeof j.exp !== "number") {
      sessionStorage.removeItem(KEY);
      return null;
    }
    if (Date.now() > j.exp) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return j;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function writeHeadSession(productionId: string, label?: string): void {
  const payload: HeadSession = { productionId, exp: Date.now() + TTL_MS, label };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearHeadSession(): void {
  sessionStorage.removeItem(KEY);
}
