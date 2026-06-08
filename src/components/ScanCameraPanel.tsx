import { useEffect, useRef, useState } from "react";
import { playCameraShutter } from "@/lib/cameraFeedback";
import { hapticCameraCapture, hapticSuccess } from "@/lib/haptics";
import { cropVideoFrameToGuide } from "@/lib/labelOcrImage";
import {
  scanLabelFromCapture,
  type LabelScanOutcome,
  type ScanReadPhase,
} from "@/lib/labelOcrCloud";
import type { LabelOcrFields } from "@/lib/labelOcr";
import { captureVideoFrame, decodeQrFromCanvas } from "@/lib/scanQrFromImage";

type ScanMode = "qr" | "label";

type Props = {
  mode: ScanMode;
  onQrDecoded: (text: string) => void;
  onLabelFields?: (fields: LabelOcrFields) => void;
  onLabelScan?: (outcome: LabelScanOutcome) => void;
  onCameraError?: (message: string | null) => void;
};

function triggerCaptureFeedback(setFlash: (on: boolean) => void): void {
  hapticCameraCapture();
  playCameraShutter();
  setFlash(true);
  window.setTimeout(() => setFlash(false), 120);
}

export function ScanCameraPanel({
  mode,
  onQrDecoded,
  onLabelFields,
  onLabelScan,
  onCameraError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readPhase, setReadPhase] = useState<ScanReadPhase | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setReady(false);
    onCameraError?.(null);

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            // @ts-expect-error focusMode in advanced mobile constraints
            focusMode: { ideal: "continuous" },
          },
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
        onCameraError?.(e instanceof Error ? e.message : "Camera could not start.");
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, onCameraError]);

  async function onScan() {
    const video = videoRef.current;
    if (!video || !ready || busy) return;

    triggerCaptureFeedback(setFlash);
    setBusy(true);
    setReadPhase(null);

    try {
      const canvas = mode === "label" ? cropVideoFrameToGuide(video) : await captureVideoFrame(video);
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);

      if (mode === "qr") {
        const text = await decodeQrFromCanvas(canvas);
        if (!text?.trim()) {
          onCameraError?.("No QR in frame — center the code and tap Scan again.");
          return;
        }
        hapticSuccess();
        onCameraError?.(null);
        onQrDecoded(text.trim());
        return;
      }

      const outcome = await scanLabelFromCapture(canvas, jpegDataUrl, (phase) => setReadPhase(phase));
      const hasFields = Boolean(outcome.fields.job || outcome.fields.fabric || outcome.fields.size);

      onLabelFields?.(outcome.fields);
      onLabelScan?.(outcome);
      onCameraError?.(null);

      if (hasFields) hapticSuccess();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Could not read scan.";
      const message =
        raw.includes("MIME type") || raw.includes("Failed to fetch") || raw.includes("Load failed")
          ? "Refresh the page, then try Scan again."
          : raw || "Could not read scan.";
      onLabelScan?.({
        fields: { job: "", fabric: "", size: "" },
        status: "error",
        message,
      });
    } finally {
      setBusy(false);
      setReadPhase(null);
    }
  }

  const readingLabel =
    readPhase === "phone" ? "Reading on phone…" : readPhase === "cloud" ? "Reading sticker…" : "Reading…";

  return (
    <div className="scan-camera scan-camera--optional">
      <p className="scan-camera__label muted">Optional — tap Scan to fill the fields above</p>
      <div className={`scan-viewfinder${mode === "label" ? " scan-viewfinder--label" : ""}`}>
        <video ref={videoRef} className="scan-viewfinder__video" playsInline muted />
        <div className="scan-viewfinder__guide" aria-hidden>
          <span className="scan-corner scan-corner--tl" />
          <span className="scan-corner scan-corner--tr" />
          <span className="scan-corner scan-corner--bl" />
          <span className="scan-corner scan-corner--br" />
        </div>
        <div className={`scan-viewfinder__flash${flash ? " scan-viewfinder__flash--on" : ""}`} aria-hidden />
        {!ready ? (
          <div className="scan-viewfinder__loading muted">Starting camera…</div>
        ) : null}
        {busy ? (
          <div className="scan-viewfinder__reading muted" role="status">
            {readingLabel}
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-primary scan-viewfinder__scan-btn"
          disabled={!ready || busy}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!ready || busy) return;
            void onScan();
          }}
        >
          {busy ? "Reading…" : "Scan"}
        </button>
      </div>
    </div>
  );
}
