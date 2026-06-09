import type { FabricLabelOcrPlugin } from "./labelOcrNative";

/** Web/PWA — on-device OCR lives in the native Capacitor build. */
export class FabricLabelOcrWeb implements FabricLabelOcrPlugin {
  async isAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }

  async recognizeLabel(): Promise<{ job: string; fabric: string; size: string; rawText: string }> {
    return { job: "", fabric: "", size: "", rawText: "" };
  }
}
