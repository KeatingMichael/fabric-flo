import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RecentLocationChips } from "@/components/RecentLocationChips";
import { ScanCameraPanel } from "@/components/ScanCameraPanel";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { isNativeApp } from "@/lib/native";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { joinLabelFields, looksLikeWeakFabricLine, looksLikeWeakJobLine, looksLikeWeakSizeLine } from "@/lib/labelOcr";
import {
  getLastLocationId,
  getRecentLocationIds,
  rememberRecentLocation,
} from "@/lib/recentLocations";
import { readScanNavState } from "@/lib/scanNavigation";
import { resolveScan } from "@/lib/scanResolve";
import type { LocationKind, ScanMethod } from "@/types";
import { LOCATION_KIND_LABEL, LOCATION_KIND_ORDER } from "@/types";

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
  const production = useActiveProduction();
  const { logScan, linkUnknownScan, rememberHandwrittenMark } = useApp();
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
  const [locId, setLocId] = useState("");
  const [locationUnlocked, setLocationUnlocked] = useState(false);
  const [savedFlash, setSavedFlash] = useState<{ itemName: string; locationLabel: string } | null>(
    null
  );

  const labelDraft = joinLabelFields(labelJob, labelFabric, labelSize);
  const scanText = (mode === "qr" ? manual : labelDraft).trim();

  const isLocationLocked = Boolean(
    lockedLocationId &&
      lockedLocationLabel &&
      !locationUnlocked &&
      production?.locations.some((l) => l.id === lockedLocationId)
  );

  const recentLocIds = useMemo(
    () => (production ? getRecentLocationIds(production.id) : []),
    [production?.id]
  );

  useEffect(() => {
    if (!production) return;
    if (isLocationLocked && lockedLocationId) {
      setLocId(lockedLocationId);
      return;
    }
    const last = getLastLocationId(production.id);
    if (last && production.locations.some((l) => l.id === last)) {
      setLocId(last);
    }
  }, [production, isLocationLocked, lockedLocationId]);

  function groupedLocs(kind: LocationKind) {
    return production?.locations.filter((l) => l.kind === kind) ?? [];
  }

  function scanMethodForAdd(): ScanMethod {
    return mode === "qr" ? "qr" : "label";
  }

  function unknownItemName(raw: string): string {
    const fabric = labelFabric.trim();
    const size = labelSize.trim();
    if (fabric && size) return `${fabric} · ${size}`;
    if (fabric) return fabric;
    if (labelJob.trim()) return labelJob.trim();
    return raw;
  }

  function clearScanFields() {
    setManual("");
    setLabelJob("");
    setLabelFabric("");
    setLabelSize("");
  }

  function addToLog() {
    if (!production || !scanText) return;
    const loc = production.locations.find((l) => l.id === locId);
    if (!loc) {
      setError("Choose a place for this scan — or add one under Places.");
      return;
    }

    setError(null);
    rememberRecentLocation(production.id, loc.id);

    const resolved = resolveScan(production, scanText, scanMethodForAdd());
    const scanMethod = resolved.method;
    const itemName = resolved.item
      ? resolved.item.name
      : unknownItemName(scanText);

    if (resolved.item) {
      if (scanMethod === "label" || scanMethod === "manual") {
        rememberHandwrittenMark(production.id, resolved.item.id, scanText);
      }
      logScan({
        productionId: production.id,
        itemId: resolved.item.id,
        itemKind: resolved.item.kind,
        itemName: resolved.item.name,
        locationId: loc.id,
        locationKind: loc.kind,
        locationLabel: loc.name,
        rawQr: scanText,
        scanMethod,
      });
    } else {
      linkUnknownScan(production.id, scanText, "fabric", unknownItemName(scanText), loc.id);
    }

    hapticSuccess();
    setSavedFlash({ itemName, locationLabel: loc.name });
    clearScanFields();
    setLocationUnlocked(false);
    navigate("/scan", {
      replace: true,
      state: { lockedLocationId: loc.id, lockedLocationLabel: loc.name },
    });
  }

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

  function onQrDecoded(text: string) {
    hapticSuccess();
    setManual(text.trim());
    setError(null);
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

  if (!production) {
    return (
      <div className="page stack">
        <h1>Scan</h1>
        <p>Open a production first to scan fabrics and bags.</p>
        <Link to="/app" className="btn btn-primary btn-block">
          Sign in
        </Link>
      </div>
    );
  }

  const hasPlaces = production.locations.length > 0;
  const canAddToLog = Boolean(scanText && locId && hasPlaces);

  return (
    <div className="page stack">
      <h1>{mode === "label" ? "Scan rental label" : "Scan dynamic QR"}</h1>
      <p>
        {mode === "label" ? (
          <>
            Most gear uses a <strong>rental-house sticker</strong> — job number, fabric type, and size.
            Every house writes differently. Fill the frame with the whole label; the app pulls out each
            field from whatever it reads.
          </>
        ) : (
          <>
            Use this when a piece has a Fabric Flo <strong>dynamic QR</strong> printed on it. Most inventory
            today still uses handwritten rental labels instead.
          </>
        )}
        {isNativeApp() ? " Camera access is not recorded." : null}
      </p>

      {isLocationLocked ? (
        <div className="card locked-location-banner" style={{ borderColor: "rgba(56, 189, 248, 0.35)" }}>
          <div className="row" style={{ justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
            <div>
              <div className="muted" style={{ fontSize: "0.82rem" }}>
                Logging everything to
              </div>
              <strong>{lockedLocationLabel}</strong>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 40, padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
              onClick={() => setLocationUnlocked(true)}
            >
              Change
            </button>
          </div>
        </div>
      ) : null}

      {savedFlash ? (
        <div className="scan-flash stack" role="status" style={{ gap: "0.65rem" }}>
          <div className="row" style={{ width: "100%", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <strong>Saved to log.</strong> {savedFlash.itemName} → {savedFlash.locationLabel}
            </div>
            <button
              type="button"
              className="scan-flash__dismiss"
              onClick={() => setSavedFlash(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Scan the next piece — label fields clear after each save.
          </p>
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
          {mode === "qr" ? "Paste QR value" : "What we read"}
        </h2>
        <p style={{ marginBottom: 0 }}>
          {mode === "qr"
            ? "If the camera is unavailable, paste the QR JSON or code here."
            : "Fix anything the camera missed, then Add to Log to save and scan the next piece."}
        </p>
        {!hasPlaces ? (
          <div className="card" style={{ borderColor: "rgba(251,191,36,0.35)" }}>
            <strong style={{ color: "var(--warning)" }}>Add a place first</strong>
            <p style={{ marginBottom: 0 }}>
              Create at least one studio, filming location, or truck before logging scans.
            </p>
            <Link to="/locations" className="btn btn-secondary btn-block" style={{ marginTop: "0.75rem" }}>
              Set up places
            </Link>
          </div>
        ) : !isLocationLocked ? (
          <>
            <RecentLocationChips
              locations={production.locations}
              recentIds={recentLocIds}
              selectedId={locId}
              onPick={setLocId}
            />
            <div className="field">
              <label htmlFor="scan-log-loc">Place for this scan</label>
              <select
                id="scan-log-loc"
                className="select"
                value={locId}
                onChange={(e) => setLocId(e.target.value)}
              >
                <option value="">Choose…</option>
                {LOCATION_KIND_ORDER.map((kind) => {
                  const group = groupedLocs(kind);
                  if (!group.length) return null;
                  return (
                    <optgroup key={kind} label={LOCATION_KIND_LABEL[kind]}>
                      {group.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          </>
        ) : null}
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
              <label htmlFor="label-job">Job or sticker number</label>
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
              <label htmlFor="label-fabric">Fabric type</label>
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
              <label htmlFor="label-size">Size</label>
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
          className="btn btn-secondary btn-block"
          disabled={!canAddToLog}
          onClick={addToLog}
        >
          Add to Log
        </button>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!scanText}
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
