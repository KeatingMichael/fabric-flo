const STORAGE_KEY = "fabricFloPendingJoin";

export type PendingInviteJoin = {
  email: string;
  token: string;
};

export function setPendingInviteJoin(data: PendingInviteJoin): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ email: data.email.trim(), token: data.token.trim() })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPendingInviteJoin(): PendingInviteJoin | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { email?: string; token?: string };
    if (!o || typeof o.token !== "string" || !o.token.trim()) return null;
    return { email: typeof o.email === "string" ? o.email.trim() : "", token: o.token.trim() };
  } catch {
    return null;
  }
}

export function clearPendingInviteJoin(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
