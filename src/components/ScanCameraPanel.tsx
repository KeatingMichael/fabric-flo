import { useEffect, useRef, useState } from "react";
import { hapticLight } from "@/lib/haptics";
import { cropVideoFrameToGuide, recognizeLabelFromImage } from "@/lib/labelOcr";
import { captureVideoFrame, decodeQrFromCanvas } from "@/lib/scanQrFromImage";

type ScanMode = "qr" | "label";

type Props = {
  mode: ScanMode;
  onQrDecoded: (text: string) => void;
  onLabelText: (text: string) => void;
  onError?: (message: string | null) => void;
};

export function ScanCameraPanel({ mode, onQrDecoded, onLabelText, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    setPreview(null);
    onError?.(null);

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setReady(true);
        }
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Camera could not start.");
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, onError]);

  async function onScan() {
    const video = videoRef.current;
    if (!video || !ready || busy) return;
    setBusy(true);
    setPreview(null);
    onError?.(null);

    try {
      const canvas = mode === "label" ? cropVideoFrameToGuide(video) : await captureVideoFrame(video);
      setPreview(canvas.toDataURL("image/jpeg", 0.92));

      if (mode === "qr") {
        const text = await decodeQrFromCanvas(canvas);
        if (!text?.trim()) {
          onError?.("No QR code in frame — center the code and tap SCAN again.");
          return;
        }
        hapticLight();
        onQrDecoded(text.trim());
        return;
      }

      const text = await recognizeLabelFromImage(canvas);
      if (!text) {
        onError?.("No text detected — try brighter light, closer framing, or type the label below.");
        return;
      }
      hapticLight();
      onLabelText(text);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not read scan.");
    } finally {
      setBusy(false);
    }
  }

  const hint =
    mode === "qr"
      ? "Center the dynamic QR in the frame, then tap SCAN."
      : "Center the writing in the frame, then tap SCAN.";

  return (
    <div className="stack scan-camera">
      <div className="scan-viewfinder">
        <video ref={videoRef} className="scan-viewfinder__video" playsInline muted />
        <div className="scan-viewfinder__guide" aria-hidden>
          <span className="scan-corner scan-corner--tl" />
          <span className="scan-corner scan-corner--tr" />
          <span className="scan-corner scan-corner--bl" />
          <span className="scan-corner scan-corner--br" />
        </div>
        {!ready ? (
          <div className="scan-viewfinder__loading muted">Starting camera…</div>
        ) : null}
        <button
          type="button"
          className="btn btn-primary scan-viewfinder__scan-btn"
          disabled={!ready || busy}
          onClick={() => void onScan()}
        >
          {busy ? "Scanning…" : "SCAN"}
        </button>
      </div>
      <p className="muted scan-camera__hint">{hint}</p>
      {preview ? (
        <img
          src={preview}
          alt="Last capture"
          className="scan-camera__preview"
        />
      ) : null}
    </div>
  );
}
