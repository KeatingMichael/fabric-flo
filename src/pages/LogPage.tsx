import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { formatLocalDateTime } from "@/lib/storage";
import { LOCATION_KIND_LABEL, type ScanMethod } from "@/types";
import { readLogNavState } from "@/lib/scanNavigation";
import { SCAN_METHOD_LABEL } from "@/lib/scanResolve";
import { DepartmentHeadListsPanel } from "@/components/DepartmentHeadListsPanel";
import { getHandwrittenMarks } from "@/lib/labelText";

type LogFlash = { itemName: string; locationLabel: string };

export function LogPage() {
  const production = useActiveProduction();
  const { scanLog } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const initialNav = readLogNavState(location.state);
  const [flash, setFlash] = useState<LogFlash | null>(() => initialNav.flash ?? null);
  const [lockedLocationId, setLockedLocationId] = useState<string | undefined>(
    () => initialNav.lockedLocationId
  );
  const [lockedLocationLabel, setLockedLocationLabel] = useState<string | undefined>(
    () => initialNav.lockedLocationLabel
  );

  useEffect(() => {
    const incoming = readLogNavState(location.state);
    if (incoming.flash) setFlash(incoming.flash);
    if (incoming.lockedLocationId) setLockedLocationId(incoming.lockedLocationId);
    if (incoming.lockedLocationLabel) setLockedLocationLabel(incoming.lockedLocationLabel);
    if (incoming.flash || incoming.lockedLocationId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const entries = useMemo(() => {
    if (!production) return [];
    return scanLog
      .filter((e) => e.productionId === production.id)
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [production, scanLog]);

  if (!production) return null;

  return (
    <div className="page stack">
      <h1>Scan log</h1>
      <p>
        Newest first. Entries from dynamic QR, handwritten labels, or manual text all appear here and in
        inventory CSV and PDF exports.
      </p>

      <DepartmentHeadListsPanel />

      {flash ? (
        <div className="scan-flash stack" role="status" style={{ gap: "0.65rem" }}>
          <div className="row" style={{ width: "100%", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <strong>Saved.</strong> {flash.itemName} → {flash.locationLabel}
            </div>
            <button
              type="button"
              className="scan-flash__dismiss"
              onClick={() => setFlash(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          {lockedLocationId && lockedLocationLabel ? (
            <Link
              to="/scan"
              state={{ lockedLocationId, lockedLocationLabel }}
              className="btn btn-primary btn-block"
              style={{ margin: 0 }}
            >
              Scan next → {lockedLocationLabel}
            </Link>
          ) : (
            <Link to="/scan" className="btn btn-secondary btn-block" style={{ margin: 0 }}>
              Scan another
            </Link>
          )}
        </div>
      ) : lockedLocationId && lockedLocationLabel ? (
        <div className="card row" style={{ justifyContent: "space-between", width: "100%" }}>
          <span>
            Still scanning to <strong>{lockedLocationLabel}</strong>
          </span>
          <Link
            to="/scan"
            state={{ lockedLocationId, lockedLocationLabel }}
            className="btn btn-primary"
            style={{ minHeight: 40, padding: "0.4rem 0.75rem", whiteSpace: "nowrap" }}
          >
            Scan next
          </Link>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="card stack">
          <p style={{ marginBottom: 0 }}>No scans yet. Add places and inventory first, then scan from Home.</p>
          <Link to="/scan" className="btn btn-primary btn-block">
            Start scan
          </Link>
          <Link to="/dashboard" className="btn btn-secondary btn-block">
            Back to Home
          </Link>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {entries.map((e) => (
            <li key={e.id} className="card stack">
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {formatLocalDateTime(e.scannedAt)}
              </div>
              <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                <span className="pill pill-label" style={{ fontSize: "0.7rem" }}>
                  {SCAN_METHOD_LABEL[(e.scanMethod ?? "qr") as ScanMethod]}
                </span>
                <strong>{e.itemName}</strong>
              </div>
              {production.rentalHouseName ? (
                <div className="muted" style={{ marginTop: "-0.25rem" }}>
                  Rental house: <strong>{production.rentalHouseName}</strong>
                </div>
              ) : null}
              <div>
                <span className="muted">Location: </span>
                {e.locationLabel}{" "}
                <span className="muted">({LOCATION_KIND_LABEL[e.locationKind]})</span>
              </div>
              {(() => {
                const item = production.items.find((i) => i.id === e.itemId);
                if (!item) return null;
                const stickerIds = getHandwrittenMarks(item);
                return (
                  <div className="muted" style={{ fontSize: "0.88rem" }}>
                    {item.size ? (
                      <>
                        <span className="muted">Size: </span>
                        {item.size}
                        {" · "}
                      </>
                    ) : null}
                    {stickerIds.length ? (
                      <>
                        <span className="muted">Sticker IDs: </span>
                        {stickerIds.join(" · ")}
                      </>
                    ) : (
                      <>
                        <span className="muted">Sticker/QR: </span>
                        {e.rawQr}
                      </>
                    )}
                  </div>
                );
              })()}
              <details>
                <summary className="muted" style={{ cursor: "pointer" }}>
                  Label / scan text
                </summary>
                <code
                  style={{
                    display: "block",
                    marginTop: "0.35rem",
                    wordBreak: "break-all",
                    fontSize: "0.78rem",
                    background: "var(--surface)",
                    padding: "0.5rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {e.rawQr}
                </code>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
