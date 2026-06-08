/** Decode a dynamic QR from a captured camera frame (still photo). */
export async function decodeQrFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );
  if (!blob) return null;

  const file = new File([blob], "scan.jpg", { type: "image/jpeg" });
  const helperId = "qr-still-scan-helper";
  let el = document.getElementById(helperId);
  if (!el) {
    el = document.createElement("div");
    el.id = helperId;
    el.hidden = true;
    document.body.appendChild(el);
  }

  const { Html5Qrcode } = await import("html5-qrcode");
  const scanner = new Html5Qrcode(helperId);
  try {
    return await scanner.scanFile(file, false);
  } catch {
    return null;
  } finally {
    try {
      await scanner.clear();
    } catch {
      /* ignore */
    }
  }
}

export async function captureVideoFrame(video: HTMLVideoElement): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture frame.");
  ctx.drawImage(video, 0, 0);
  return canvas;
}
