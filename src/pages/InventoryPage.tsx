import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { readInventoryNavState } from "@/lib/scanNavigation";
import { resolveScan } from "@/lib/scanResolve";
import { getLastLocationId, rememberRecentLocation } from "@/lib/recentLocations";
import { InventoryNameField } from "@/components/InventoryNameField";
import { ItemLabelMarks } from "@/components/ItemLabelMarks";
import { ItemQrCodes } from "@/components/ItemQrCodes";
import { getInventoryPieceLabel, inventoryNameOptionsForKind } from "@/lib/inventoryPieces";
import { filterInventoryItems } from "@/lib/inventorySearch";
import { isDynamicTrackingPayload } from "@/lib/qrPayload";
import { openQrPrintSheet } from "@/lib/qrPrint";
import { hapticSuccess } from "@/lib/haptics";
import { formatLocalDateTime, lastScanForItem } from "@/lib/storage";
import type { ItemCondition, Production } from "@/types";
import { effectiveItemCondition, ITEM_CONDITION_LABEL } from "@/types";

/** N/A = one physical piece (one dynamic QR). 2–50 = add that many separate rows. */
const QUANTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "na", label: "N/A (one piece)" },
  ...Array.from({ length: 49 }, (_, i) => {
    const n = i + 2;
    return { value: String(n), label: String(n) };
  }),
];

function pickDefaultLocation(prod: Production) {
  if (prod.locations.length === 0) return null;
  const lastId = getLastLocationId(prod.id);
  if (lastId) {
    const found = prod.locations.find((l) => l.id === lastId);
    if (found) return found;
  }
  return prod.locations[0] ?? null;
}

export function InventoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const production = useActiveProduction();
  const { scanLog, addItems, removeItem, updateItem, logScan } = useApp();
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [quantityChoice, setQuantityChoice] = useState("na");
  const [vendorToken, setVendorToken] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const nameOptions = useMemo(
    () => inventoryNameOptionsForKind(production?.items ?? [], "fabric"),
    [production?.items]
  );

  const filteredItems = useMemo(
    () => (production ? filterInventoryItems(production.items, searchQuery, "all") : []),
    [production, searchQuery]
  );

  useEffect(() => {
    if (!production) return;
    const nav = readInventoryNavState(location.state);
    const raw = nav.raw?.trim();
    if (!raw) return;

    const resolved = resolveScan(production, raw, nav.scanMethod);
    if (resolved.item) {
      setSearchQuery(resolved.item.name);
      if (nav.scanMethod === "qr") {
        const prodLog = scanLog.filter((e) => e.productionId === production.id);
        const last = lastScanForItem(prodLog, production.id, resolved.item.id);
        const lockedLoc =
          nav.lockedLocationId && production.locations.some((l) => l.id === nav.lockedLocationId)
            ? production.locations.find((l) => l.id === nav.lockedLocationId) ?? null
            : null;
        const fallbackLoc = last
          ? production.locations.find((l) => l.id === last.locationId) ??
            production.locations.find((l) => l.name === last.locationLabel) ??
            null
          : null;
        const loc = lockedLoc ?? fallbackLoc;
        if (loc) {
          rememberRecentLocation(production.id, loc.id);
          logScan({
            productionId: production.id,
            itemId: resolved.item.id,
            itemKind: resolved.item.kind,
            itemName: resolved.item.name,
            locationId: loc.id,
            locationKind: loc.kind,
            locationLabel: loc.name,
            rawQr: raw,
            scanMethod: "qr",
          });
          hapticSuccess();
        }
      }
    } else if (nav.scanMethod === "label" || nav.scanMethod === "manual") {
      setVendorToken(raw);
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, production]);

  if (!production) return null;
  const prod = production;

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const aliases = [vendorToken.trim()].filter(Boolean);
    const quantity =
      quantityChoice === "na" ? 1 : Number.parseInt(quantityChoice, 10) || 1;
    const created = addItems(
      prod.id,
      "fabric",
      name.trim() || "Fabric",
      aliases,
      notes,
      undefined,
      size,
      quantity
    );
    const first = created[0];
    const tracking = first?.qrAliases.find(isDynamicTrackingPayload);
    if (tracking && first) {
      try {
        await openQrPrintSheet({
          title: first.name,
          subtitle:
            created.length > 1
              ? `Piece 1 of ${created.length} — dynamic tracking QR`
              : "Dynamic tracking code — print and stick on the piece",
          payload: tracking,
          kindLabel: "Fabric & bag",
        });
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not open print sheet.");
      }
    }

    const loc = pickDefaultLocation(prod);
    if (loc) {
      rememberRecentLocation(prod.id, loc.id);
      const rawBase = vendorToken.trim() || "Added to rental list";
      for (const item of created) {
        logScan({
          productionId: prod.id,
          itemId: item.id,
          itemKind: item.kind,
          itemName: item.name,
          locationId: loc.id,
          locationKind: loc.kind,
          locationLabel: loc.name,
          rawQr: rawBase,
          scanMethod: "manual",
        });
      }
      hapticSuccess();
      navigate("/log", {
        state: {
          flash: {
            itemName: created.length > 1 ? `${created.length} pieces` : first!.name,
            locationLabel: loc.name,
          },
          lockedLocationId: loc.id,
          lockedLocationLabel: loc.name,
        },
      });
    } else if (created.length > 1) {
      window.alert(
        `Added ${created.length} separate pieces (each with its own dynamic QR). Add studios & trucks under Places, then use Add to list again to log each batch to the scan log.`
      );
    }
    setName("");
    setSize("");
    setQuantityChoice("na");
    setVendorToken("");
    setNotes("");
  }

  const prodLog = scanLog.filter((e) => e.productionId === prod.id);

  const listLabel = searchQuery.trim()
    ? `Showing ${filteredItems.length} of ${prod.items.length}`
    : `Rental list (${prod.items.length})`;

  return (
    <div className="page stack">
      <h1>Fabrics &amp; bags</h1>
      <p>
        One row = one fabric and its matching bag on the rental inventory (same dynamic QR or rental-house label).
        Many rows can share the same name and size — each pair gets its own tracking code.
      </p>

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Add item</h2>
        <form className="stack" onSubmit={onAdd}>
          <InventoryNameField
            id="it-name"
            label="Fabric type"
            value={name}
            onChange={setName}
            options={nameOptions}
            placeholder="Choose from fabric list or type a new type"
            helperText="Fabric Flow fabric list (top to bottom, exact names). Each fabric + bag pair gets one dynamic QR or rental-house label."
          />
          <div className="field">
            <label htmlFor="it-size">Size</label>
            <input
              id="it-size"
              className="input"
              placeholder={`12'-0" x 12'-0"`}
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="it-qty">Quantity</label>
            <select
              id="it-qty"
              className="select"
              value={quantityChoice}
              onChange={(e) => setQuantityChoice(e.target.value)}
            >
              {QUANTITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
              <strong>N/A</strong> adds one fabric + bag pair (one dynamic QR or label). Pick a number to add several
              identical lines at once — each pair still gets its own tracking code.
            </p>
          </div>
          <div className="field">
            <label htmlFor="it-vendor">Rental sticker # (optional)</label>
            <input
              id="it-vendor"
              className="input"
              placeholder="e.g. 1247, A-12 — on fabric and matching bag"
              value={vendorToken}
              onChange={(e) => setVendorToken(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="it-notes">Notes</label>
            <textarea
              id="it-notes"
              className="textarea"
              placeholder="e.g. Lost, damaged"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={!name.trim()}>
            Add to list
          </button>
          <p className="muted" style={{ marginBottom: 0, fontSize: "0.82rem" }}>
            When you have studios &amp; trucks saved, <strong>Add to list</strong> logs each piece at your last-used
            place and opens the <strong>Log</strong> for proof. Add places first if this is a new show.
          </p>
        </form>
      </section>

      <section className="stack inventory-list-section">
        <h2 className="muted" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.08em" }}>
          {listLabel}
        </h2>

        {prod.items.length > 0 ? (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="inv-search">Search inventory</label>
              <input
                id="inv-search"
                className="input"
                type="search"
                placeholder="Name, size, sticker #, notes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
          </>
        ) : null}

        {prod.items.length === 0 ? (
          <p>Nothing here yet — add your first fabric and bag pair above.</p>
        ) : filteredItems.length === 0 ? (
          <p className="muted">No pieces match your search — try fewer words or clear the filter.</p>
        ) : (
          filteredItems.map((item) => {
            const last = lastScanForItem(prodLog, prod.id, item.id);
            const cond = effectiveItemCondition(item);
            const pieceLabel = getInventoryPieceLabel(item, prod.items);
            return (
              <article
                key={item.id}
                className={`card stack${cond !== "ok" ? " item-card-flagged" : ""}`}
              >
                <div className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                  <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                    {cond !== "ok" ? (
                      <span className={cond === "lost" ? "pill pill-lost" : "pill pill-damaged"}>
                        {ITEM_CONDITION_LABEL[cond]}
                      </span>
                    ) : null}
                    <strong>{item.name}</strong>
                    {item.size ? (
                      <span className="muted" style={{ fontSize: "0.9rem" }}>
                        {item.size}
                      </span>
                    ) : null}
                    {pieceLabel ? (
                      <span className="pill pill-piece" style={{ fontSize: "0.7rem" }}>
                        {pieceLabel}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ minHeight: 40, padding: "0.35rem 0.65rem" }}
                    onClick={() => {
                      const label = pieceLabel ? `${item.name} (${pieceLabel})` : item.name;
                      if (window.confirm(`Remove "${label}" from this production?`)) {
                        removeItem(prod.id, item.id);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div className="field">
                  <span className="muted">Status</span>
                  <div className="row" style={{ width: "100%" }}>
                    {(["ok", "lost", "damaged"] as const satisfies readonly ItemCondition[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`btn ${cond === c ? "btn-primary" : "btn-secondary"}`}
                        style={{ flex: 1, padding: "0.55rem 0.35rem", fontSize: "0.82rem", minHeight: 44 }}
                        onClick={() => updateItem(prod.id, item.id, { condition: c })}
                      >
                        {ITEM_CONDITION_LABEL[c]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={`size-${item.id}`}>Size (optional)</label>
                  <input
                    id={`size-${item.id}`}
                    className="input"
                    placeholder={`20'-0" x 20'-0"`}
                    defaultValue={item.size ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (item.size ?? "")) {
                        updateItem(prod.id, item.id, { size: v || undefined });
                      }
                    }}
                  />
                </div>
                {item.notes ? <p style={{ marginBottom: 0 }}>{item.notes}</p> : null}
                <div className="muted" style={{ fontSize: "0.88rem" }}>
                  Last scan:{" "}
                  {last ? (
                    <>
                      {formatLocalDateTime(last.scannedAt)} — {last.locationLabel}
                    </>
                  ) : (
                    "Not scanned yet"
                  )}
                </div>
                <ItemLabelMarks productionId={prod.id} item={item} />
                <ItemQrCodes productionId={prod.id} item={item} pieceLabel={pieceLabel} />
              </article>
            );
          })
        )}
      </section>

      <Link to="/locations" className="btn btn-primary btn-block" style={{ fontSize: "1.05rem", padding: "0.95rem" }}>
        Continue to Places
      </Link>
      <p className="muted" style={{ marginBottom: 0, fontSize: "0.82rem", textAlign: "center" }}>
        Set studios/locations &amp; trucks so manual adds can log where fabric is.
      </p>
      <p className="muted" style={{ marginBottom: 0, marginTop: "-0.2rem", fontSize: "0.82rem", textAlign: "center" }}>
        Dynamic QR scans will show location and time stamp in log.
      </p>
    </div>
  );
}
