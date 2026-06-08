import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ScanCameraPanel } from "@/components/ScanCameraPanel";
import { isNativeApp } from "@/lib/native";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { joinLabelFields, looksLikeWeakFabricLine, looksLikeWeakJobLine, looksLikeWeakSizeLine } from "@/lib/labelOcr";
import { readScanNavState } from "@/lib/scanNavigation";
import type { ScanMethod } from "@/types";

type ScanMode = "qr" | "label";

const RENTAL_FABRIC_HINTS = [
  "SOLID",
  "BLUE FOAM",
  "DIGI GREEN",
  "CHROMA GREEN",
  "DUVET",
  "DUVETYNE",
  "MUSLIN",
  "VELVET",
  "FOAM",
  "BOUNCE",
  "CHROMA",
  "BLACK",
  "WHITE",
  "GRID",
  "SILK",
  "SATIN",
  "SCRIM",
  "NET",
];

export function ScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const scanNav = readScanNavState(location.state);
  const lockedLocationId = scanNav.lockedLocationId;
  const lockedLocationLabel = scanNav.lockedLocationLabel;
  const jobInputRef = useRef<HTMLInputElement>(null);
  const fabricInputRef = useRef<HTMLInputElement>(null);
  const sizeInputRef = useRef<HTMLInputElement>(null);
  const focusFieldAfterScan = useRef<"job" | "fabric" | "size" | null>(null);

  const [mode, setMode] = useState<ScanMode>("label");
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [labelJob, setLabelJob] = useState("");
  const [labelFabric, setLabelFabric] = useState("");
  const [labelSize, setLabelSize] = useState("");

  const labelDraft = joinLabelFields(labelJob, labelFabric, labelSize);

  function goFabrics(raw: string, scanMethod: ScanMethod) {
    const t = raw.trim();
    if (!t) return;
    hapticLight();
    navigate("/inventory", {
      state: {
        raw: t,
        scanMethod,
        lockedLocationId,
        lockedLocationLabel,
      },
    });
  }

  function clearLockedLocation() {
    navigate("/scan", { replace: true, state: {} });
  }

  function onQrDecoded(text: string) {
    hapticSuccess();
    goFabrics(text, "qr");
  }

  useEffect(() => {
    if (mode !== "label" || !focusFieldAfterScan.current) return;
    const target = focusFieldAfterScan.current;
    focusFieldAfterScan.current = null;
    const input =
      target === "job"
        ? jobInputRef.current
        : target === "fabric"
          ? fabricInputRef.current
          : sizeInputRef.current;
    input?.focus();
    input?.select();
  }, [labelJob, labelFabric, labelSize, mode]);

  return (
    <div className="page stack">
      <h1>{mode === "label" ? "Scan rental label" : "Scan dynamic QR"}</h1>
      <p>
        {mode === "label" ? (
          <>
            Most gear uses a <strong>rental-house sticker</strong> — job number, fabric type, and size.
            Every house writes differently; scan fills three lines, then tap to fix anything off.
          </>
        ) : (
          <>
            Use this when a piece has a Fabric Flo <strong>dynamic QR</strong> printed on it. Most inventory
            today still uses handwritten rental labels instead.
          </>
        )}
        {isNativeApp() ? " Camera access is not recorded." : null}
      </p>

      {lockedLocationLabel ? (
        <div className="card locked-location-banner" style={{ borderColor: "rgba(56, 189, 248, 0.35)" }}>
          <div className="row" style={{ justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
            <div>
              <div className="muted" style={{ fontSize: "0.82rem" }}>
                Same place for every scan
              </div>
              <strong>{lockedLocationLabel}</strong>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 40, padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
              onClick={clearLockedLocation}
            >
              Change
            </button>
          </div>
        </div>
      ) : null}

      <div className="row" style={{ width: "100%" }}>
        <button
          type="button"
          className={`btn ${mode === "label" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: 1 }}
          onClick={() => {
            setError(null);
            setMode("label");
          }}
        >
          Handwritten label
        </button>
        <button
          type="button"
          className={`btn ${mode === "qr" ? "btn-primary" : "btn-secondary"}`}
          style={{ flex: 1 }}
          onClick={() => {
            setError(null);
            setMode("qr");
          }}
        >
          Dynamic QR
        </button>
      </div>

      <ScanCameraPanel
        mode={mode}
        onQrDecoded={onQrDecoded}
        onLabelFields={(fields) => {
          setError(null);
          setLabelJob(fields.job);
          setLabelFabric(fields.fabric);
          setLabelSize(fields.size);
          if (looksLikeWeakJobLine(fields.job)) focusFieldAfterScan.current = "job";
          else if (looksLikeWeakFabricLine(fields.fabric)) focusFieldAfterScan.current = "fabric";
          else if (looksLikeWeakSizeLine(fields.size)) focusFieldAfterScan.current = "size";
        }}
        onError={setError}
      />

      {error ? (
        <div className="card" style={{ borderColor: "rgba(251,191,36,0.35)" }}>
          <strong style={{ color: "var(--warning)" }}>{mode === "qr" ? "Scan" : "Label"}</strong>
          <p style={{ marginBottom: 0 }}>{error}</p>
        </div>
      ) : null}

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>
          {mode === "qr" ? "Paste QR value" : "Label lines"}
        </h2>
        <p style={{ marginBottom: 0 }}>
          {mode === "qr"
            ? "If the camera is unavailable, paste the QR JSON or code here."
            : "Every rental label is different — tap SCAN again or edit any line before continuing."}
        </p>
        {mode === "qr" ? (
          <textarea
            className="textarea"
            placeholder="Paste dynamic QR JSON…"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
        ) : (
          <>
            <div className="field">
              <label htmlFor="label-job">Line 1 — job or sticker number</label>
              <input
                ref={jobInputRef}
                id="label-job"
                className="input"
                placeholder="e.g. 111023"
                value={labelJob}
                onChange={(e) => setLabelJob(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="label-fabric">Line 2 — fabric type</label>
              <input
                id="label-fabric"
                ref={fabricInputRef}
                className="input"
                placeholder="e.g. SOLID"
                value={labelFabric}
                onChange={(e) => setLabelFabric(e.target.value)}
                list="label-fabric-hints"
                autoComplete="off"
                autoCapitalize="characters"
              />
              <datalist id="label-fabric-hints">
                {RENTAL_FABRIC_HINTS.map((hint) => (
                  <option key={hint} value={hint} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="label-size">Line 3 — size</label>
              <input
                id="label-size"
                ref={sizeInputRef}
                className="input"
                placeholder={"e.g. 12' x 12'"}
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value)}
                autoComplete="off"
              />
            </div>
          </>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!(mode === "qr" ? manual : labelDraft).trim()}
          onClick={() =>
            goFabrics(mode === "qr" ? manual : labelDraft, mode === "qr" ? "qr" : "label")
          }
        >
          Continue to Fabrics
        </button>
      </section>

      <Link to="/dashboard" className="btn btn-secondary btn-block">
        Cancel
      </Link>
    </div>
  );
}
