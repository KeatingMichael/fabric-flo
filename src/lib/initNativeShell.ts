import { isNativeApp } from "@/lib/native";

/** Status bar / splash tweaks when running in Capacitor (no-op on web). */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // Capacitor packages not installed (web-only dev).
  }
}
