/** True when running inside a Capacitor native shell (iOS / Android). */
export function isNativeApp(): boolean {
  try {
    const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function isIosNative(): boolean {
  try {
    const cap = window as Window & {
      Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean };
    };
    return Boolean(cap.Capacitor?.isNativePlatform?.() && cap.Capacitor?.getPlatform?.() === "ios");
  } catch {
    return false;
  }
}
