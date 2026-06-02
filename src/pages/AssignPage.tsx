import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RecentLocationChips } from "@/components/RecentLocationChips";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { getHandwrittenMarks } from "@/lib/labelText";
import {
  getLastLocationId,
  getRecentLocationIds,
  rememberRecentLocation,
} from "@/lib/recentLocations";
import { readAssignNavState } from "@/lib/scanNavigation";
import { resolveScan, SCAN_METHOD_LABEL } from "@/lib/scanResolve";
import { hapticSuccess } from "@/lib/haptics";
import type { InventoryItem, LocationKind } from "@/types";
import { effectiveItemCondition, ITEM_CONDITION_LABEL, LOCATION_KIND_LABEL, LOCATION_KIND_ORDER } from "@/types";

export function AssignPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const production = useActiveProduction();
  const { logScan, linkUnknownScan, rememberHandwrittenMark } = useApp();

  const nav = readAssignNavState(location.state);
  const raw = nav.raw ?? "";
  const scanMethodHint = nav.scanMethod;
  const lockedLocationId = nav.lockedLocationId;
  const lockedLocationLabel = nav.lockedLocationLabel;

  const resolved = useMemo(
    () => (production && raw ? resolveScan(production, raw, scanMethodHint) : null),
    [production, raw, scanMethodHint]
  );

  const [pickedItem, setPickedItem] = useState<InventoryItem | undefined>(undefined);
  const item = pickedItem ?? resolved?.item;

  const [locId, setLocId] = useState("");
  const [locationUnlocked, setLocationUnlocked] = useState(false);
  const [unkName, setUnkName] = useState("");

  const recentLocIds = useMemo(
    () => (production ? getRecentLocationIds(production.id) : []),
    [production?.id]
  );

  useEffect(() => {
    setPickedItem(undefined);
    if (!raw.trim()) return;
    if (resolved?.item) return;
    if (scanMethodHint === "label" || scanMethodHint === "manual") {
      setUnkName(raw.trim());
    }
  }, [raw, resolved?.item, scanMethodHint]);

  const isLocationLocked = Boolean(
    lockedLocationId &&
      lockedLocationLabel &&
      !locationUnlocked &&
      production?.locations.some((l) => l.id === lockedLocationId)
  );

  useEffect(() => {
    setLocationUnlocked(false);
  }, [raw]);

  useEffect(() => {
    if (!production) return;
    if (
      lockedLocationId &&
      !locationUnlocked &&
      production.locations.some((l) => l.id === lockedLocationId)
    ) {
      setLocId(lockedLocationId);
      return;
    }
    const last = getLastLocationId(production.id);
    if (last && production.locations.some((l) => l.id === last)) {
      setLocId(last);
    } else {
      setLocId("");
    }
  }, [production, raw, lockedLocationId, locationUnlocked]);

  if (!production) return null;
  const prod = production;
  const scanMethod = resolved?.method ?? scanMethodHint ?? "manual";

  if (!raw.trim()) {
    return (
      <div className="page stack">
        <h1>No scan yet</h1>
        <p>Go back and scan a code or read a handwritten label.</p>
        <Link to="/scan" className="btn btn-primary btn-block">
          Open scanner
        </Link>
        <Link to="/dashboard" className="btn btn-secondary btn-block">
          Home
        </Link>
      </div>
    );
  }

  const locations = prod.locations;
  const hasLocs = locations.length > 0;
  const labelSuggestions = resolved?.labelMatches.filter((m) => m.item.id !== item?.id) ?? [];

  function groupedLocs(kind: LocationKind) {
    return locations.filter((l) => l.kind === kind);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!locId) return;
    const loc = locations.find((l) => l.id === locId);
    if (!loc) return;

    rememberRecentLocation(prod.id, loc.id);

    const flash = {
      itemName: item ? item.name : unkName.trim() || raw.trim(),
      locationLabel: loc.name,
    };

    if (item) {
      if (scanMethod === "label" || scanMethod === "manual") {
        rememberHandwrittenMark(prod.id, item.id, raw);
      }
      logScan({
        productionId: prod.id,
        itemId: item.id,
        itemKind: item.kind,
        itemName: item.name,
        locationId: loc.id,
        locationKind: loc.kind,
        locationLabel: loc.name,
        rawQr: raw.trim(),
        scanMethod,
      });
    } else {
      linkUnknownScan(prod.id, raw, "fabric", unkName, locId);
    }
    hapticSuccess();
    navigate("/log", {
      replace: true,
      state: {
        flash,
        lockedLocationId: loc.id,
        lockedLocationLabel: loc.name,
      },
    });
  }

  function scanAgainState() {
    return {
      lockedLocationId: isLocationLocked ? lockedLocationId : locId || lockedLocationId,
      lockedLocationLabel: isLocationLocked
        ? lockedLocationLabel
        : locations.find((l) => l.id === locId)?.name ?? lockedLocationLabel,
    };
  }

  return (
    <div className="page stack">
      <h1>Where is it?</h1>
      <div className="card stack">
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <span className="pill pill-fabric" style={{ fontSize: "0.7rem" }}>
            {SCAN_METHOD_LABEL[scanMethod]}
          </span>
        </div>
        <div className="muted">Scanned text</div>
        <code
          style={{
            display: "block",
            wordBreak: "break-all",
            fontSize: "0.85rem",
            background: "var(--surface)",
            padding: "0.6rem 0.65rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
          }}
        >
          {raw.trim()}
        </code>
      </div>

      {item ? (
        <div className="card stack">
          <div className="row" style={{ justifyContent: "flex-start" }}>
            {effectiveItemCondition(item) !== "ok" ? (
              <span className={effectiveItemCondition(item) === "lost" ? "pill pill-lost" : "pill pill-damaged"}>
                {ITEM_CONDITION_LABEL[effectiveItemCondition(item)]}
              </span>
            ) : null}
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>{item.name}</div>
          {item.size ? <div className="muted">{item.size}</div> : null}
          {getHandwrittenMarks(item).length > 0 ? (
            <p className="muted" style={{ marginBottom: 0, fontSize: "0.82rem" }}>
              Known sticker IDs: {getHandwrittenMarks(item).join(" · ")}
            </p>
          ) : null}
          <p style={{ marginBottom: 0 }}>Pick the studio, location, or truck for this scan.</p>
        </div>
      ) : (
        <div className="card stack">
          <h2 style={{ marginTop: 0 }}>Not on the rental list yet</h2>
          <p style={{ marginBottom: 0 }}>
            Name this fabric and bag pair once — we will save the label text and add a dynamic QR row. Next scan of
            the same writing will match automatically.
          </p>
          {labelSuggestions.length > 0 ? (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Did you mean?</strong>
              {labelSuggestions.map((m) => (
                <button
                  key={m.item.id}
                  type="button"
                  className="btn btn-secondary btn-block"
                  style={{ textAlign: "left" }}
                  onClick={() => setPickedItem(m.item)}
                >
                  {m.item.name}
                  {m.item.size ? ` · ${m.item.size}` : ""}
                  <span className="muted" style={{ display: "block", fontSize: "0.78rem", fontWeight: 400 }}>
                    {m.reason} ({m.score}% match)
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="unk-name">Name on label</label>
            <input
              id="unk-name"
              className="input"
              placeholder="e.g. Velvet drops — 12x20 forest"
              value={unkName}
              onChange={(e) => setUnkName(e.target.value)}
            />
          </div>
        </div>
      )}

      {!hasLocs ? (
        <div className="card" style={{ borderColor: "rgba(251,191,36,0.35)" }}>
          <strong style={{ color: "var(--warning)" }}>Add a place first</strong>
          <p style={{ marginBottom: 0 }}>
            Create at least one studio, filming location, or truck so scans have somewhere to go.
          </p>
          <Link to="/locations" className="btn btn-secondary btn-block" style={{ marginTop: "0.75rem" }}>
            Set up places
          </Link>
        </div>
      ) : (
        <form className="stack" onSubmit={onSubmit}>
          {isLocationLocked ? (
            <div className="card locked-location-banner" style={{ borderColor: "rgba(56, 189, 248, 0.35)" }}>
              <div className="row" style={{ justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
                <div>
                  <div className="muted" style={{ fontSize: "0.82rem" }}>
                    Scanning everything to
                  </div>
                  <strong style={{ fontSize: "1.05rem" }}>{lockedLocationLabel}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: 40, padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
                  onClick={() => setLocationUnlocked(true)}
                >
                  Change place
                </button>
              </div>
            </div>
          ) : null}

          {!isLocationLocked ? (
            <>
              <RecentLocationChips
                locations={locations}
                recentIds={recentLocIds}
                selectedId={locId}
                onPick={setLocId}
              />
              <div className="field">
                <label htmlFor="loc-pick">Location for this scan</label>
                <select
                  id="loc-pick"
                  className="select"
                  required
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

          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={!locId || (!item && !unkName.trim())}
            style={isLocationLocked ? { fontSize: "1.05rem", padding: "1rem" } : undefined}
          >
            {isLocationLocked && lockedLocationLabel
              ? `Save to ${lockedLocationLabel}`
              : "Save to log & inventory"}
          </button>
        </form>
      )}

      <Link
        to="/scan"
        state={scanAgainState()}
        className="btn btn-secondary btn-block"
      >
        {isLocationLocked && lockedLocationLabel
          ? `Scan next → ${lockedLocationLabel}`
          : "Scan again"}
      </Link>
    </div>
  );
}
