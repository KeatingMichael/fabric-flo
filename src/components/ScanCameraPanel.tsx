import { useCallback, useEffect, useRef, useState } from "react";
import { playCameraShutter } from "@/lib/cameraFeedback";
import { hapticCameraCapture, hapticSuccess } from "@/lib/haptics";
import { cropVideoFrameToGuide } from "@/lib/labelOcrImage";
import {
  scanLabelFromCapture,
  type LabelScanOutcome,
  type ScanReadPhase,
} from "@/lib/labelOcrCloud";
import type { LabelOcrFields } from "@/lib/labelOcr";
import {
  assessLabelFrameQualityThrottled,
  AUTO_CAPTURE_STABLE_MS,
  hintForLabelFrameQuality,
  hintTextForLabelFrame,
  type LabelFrameQuality,
} from "@/lib/labelScanQuality";
import { captureVideoFrame, decodeQrFromCanvas } from "@/lib/scanQrFromImage";

type ScanMode = "qr" | "label";

const SCAN_HARD_CAP_MS = 22_000;
const LABEL_FOCUS_MS = 150;

type Props = {
  mode: ScanMode;
  onQrDecoded: (text: string) => void;
  onLabelFields?: (fields: LabelOcrFields) => void;
  onLabelScan?: (outcome: LabelScanOutcome) => void;
  onCameraError?: (message: string | null) => void;
  onScanStart?: () => void;
  autoCapture?: boolean;
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
  onScanStart,
  autoCapture = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanGenRef = useRef(0);
  const stableSinceRef = useRef<number | null>(null);
  const scanInFlightRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readPhase, setReadPhase] = useState<ScanReadPhase | null>(null);
  const [flash, setFlash] = useState(false);
  const [frameQuality, setFrameQuality] = useState<LabelFrameQuality | null>(null);
  const [autoReady, setAutoReady] = useState(false);

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

  const runScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !ready || busy || scanInFlightRef.current) return;

    scanInFlightRef.current = true;
    triggerCaptureFeedback(setFlash);
    const scanGen = ++scanGenRef.current;
    if (mode === "label") onScanStart?.();
    setBusy(true);
    setReadPhase(null);
    setAutoReady(false);
    stableSinceRef.current = null;

    const hardCap = window.setTimeout(() => {
      if (scanGenRef.current !== scanGen) return;
      setBusy(false);
      setReadPhase(null);
      scanInFlightRef.current = false;
    }, SCAN_HARD_CAP_MS);

    try {
      if (mode === "label") {
        await new Promise((r) => window.setTimeout(r, LABEL_FOCUS_MS));
      }
      const canvas = mode === "label" ? cropVideoFrameToGuide(video) : await captureVideoFrame(video);
      const jpegDataUrl = canvas.toDataURL("image/jpeg", mode === "label" ? 0.88 : 0.95);

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
      if (scanGenRef.current !== scanGen) return;
      const hasFields = Boolean(outcome.fields.job || outcome.fields.fabric || outcome.fields.size);

      onLabelFields?.(outcome.fields);
      onLabelScan?.(outcome);
      onCameraError?.(null);

      if (hasFields) hapticSuccess();
    } catch (e) {
      if (scanGenRef.current !== scanGen) return;
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
      window.clearTimeout(hardCap);
      if (scanGenRef.current !== scanGen) return;
      setBusy(false);
      setReadPhase(null);
      scanInFlightRef.current = false;
    }
  }, [busy, mode, onCameraError, onLabelFields, onLabelScan, onQrDecoded, onScanStart, ready]);

  // Plan B: auto-capture when frame is sharp and label is visible
  useEffect(() => {
    if (mode !== "label" || !autoCapture || !ready || busy) {
      setAutoReady(false);
      stableSinceRef.current = null;
      return;
    }

    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      if (!video || busy || scanInFlightRef.current) {
        raf = window.requestAnimationFrame(tick);
        return;
      }

      const quality = assessLabelFrameQualityThrottled(video);
      if (quality) {
        setFrameQuality(quality);
        if (quality.readyToCapture) {
          if (!stableSinceRef.current) stableSinceRef.current = Date.now();
          const stableMs = Date.now() - stableSinceRef.current;
          if (stableMs >= AUTO_CAPTURE_STABLE_MS) {
            setAutoReady(true);
            void runScan();
            return;
          }
        } else {
          stableSinceRef.current = null;
          setAutoReady(false);
        }
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [autoCapture, busy, mode, ready, runScan]);

  const readingLabel =
    readPhase === "native"
      ? "Reading on device…"
      : readPhase === "phone"
        ? "Reading sticker…"
        : readPhase === "cloud"
          ? "Reading sticker…"
          : "Reading…";

  const qualityHint =
    mode === "label" && ready && !busy && frameQuality
      ? autoReady
        ? "Capturing…"
        : hintTextForLabelFrame(hintForLabelFrameQuality(frameQuality))
      : null;

  return (
    <div className="scan-camera">
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
        {qualityHint && !busy ? (
          <div className="scan-viewfinder__quality muted" role="status">
            {qualityHint}
          </div>
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
            void runScan();
          }}
        >
          {busy ? "Reading…" : "Scan"}
        </button>
      </div>
    </div>
  );
}
