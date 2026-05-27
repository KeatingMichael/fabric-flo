import { STORAGE_KEY } from "@/lib/storage";

/** Removes all Fabric Flo data stored in this browser (productions, scans, preferences). */
export function clearLocalAppData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    if (k?.startsWith("ffboot_") || k?.startsWith("ff_")) sessionStorage.removeItem(k);
  }
}
