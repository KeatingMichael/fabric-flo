import { isNativeApp } from "@/lib/native";

type HapticsModule = typeof import("@capacitor/haptics");

let hapticsModule: HapticsModule | null = null;

async function loadHaptics(): Promise<HapticsModule | null> {
  if (!isNativeApp()) return null;
  if (!hapticsModule) {
    try {
      hapticsModule = await import("@capacitor/haptics");
    } catch {
      return null;
    }
  }
  return hapticsModule;
}

function webVibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

/** Tab taps, chip picks, mode toggles. */
export function hapticSelection(): void {
  void (async () => {
    const mod = await loadHaptics();
    if (mod) {
      try {
        await mod.Haptics.selectionChanged();
      } catch {
        /* ignore */
      }
      return;
    }
    webVibrate(8);
  })();
}

/** Primary button presses. */
export function hapticLight(): void {
  void (async () => {
    const mod = await loadHaptics();
    if (mod) {
      try {
        await mod.Haptics.impact({ style: mod.ImpactStyle.Light });
      } catch {
        /* ignore */
      }
      return;
    }
    webVibrate(12);
  })();
}

/** Scan saved, sign-in, invite accepted, sync saved. */
export function hapticSuccess(): void {
  void (async () => {
    const mod = await loadHaptics();
    if (mod) {
      try {
        await mod.Haptics.notification({ type: mod.NotificationType.Success });
      } catch {
        /* ignore */
      }
      return;
    }
    webVibrate([12, 40, 12]);
  })();
}

/** Validation or recoverable errors. */
export function hapticWarning(): void {
  void (async () => {
    const mod = await loadHaptics();
    if (mod) {
      try {
        await mod.Haptics.notification({ type: mod.NotificationType.Warning });
      } catch {
        /* ignore */
      }
      return;
    }
    webVibrate([18, 30, 18]);
  })();
}
