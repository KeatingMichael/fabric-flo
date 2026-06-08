import { useState, type FormEvent } from "react";
import { QuickLocationPresets } from "@/components/BulkLocationAdd";
import { useActiveProduction, useApp } from "@/context/AppStore";
import { rememberRecentLocation } from "@/lib/recentLocations";
import type { LocationKind } from "@/types";
import { LOCATION_KIND_LABEL, LOCATION_KIND_ORDER } from "@/types";

export function LocationsPage() {
  const production = useActiveProduction();
  const { addLocation, removeLocation } = useApp();
  const [kind, setKind] = useState<LocationKind>("studio");
  const [name, setName] = useState("");

  if (!production) return null;
  const prod = production;

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const id = addLocation(prod.id, kind, name.trim());
    rememberRecentLocation(prod.id, id);
    setName("");
  }

  function pillClass(k: LocationKind) {
    if (k === "studio") return "pill pill-studio";
    if (k === "filming_location") return "pill pill-set";
    return "pill pill-truck";
  }

  return (
    <div className="page stack">
      <h1>Studios &amp; trucks</h1>
      <p>Add every place fabric might sit: stages, on-location holding, and transport rigs.</p>

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Add a place</h2>
        <form className="stack" onSubmit={onAdd}>
          <div className="field">
            <label htmlFor="loc-kind">Type</label>
            <select id="loc-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value as LocationKind)}>
              {LOCATION_KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {LOCATION_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="loc-name">Name</label>
            <input
              id="loc-name"
              className="input"
              placeholder={
                kind === "studio"
                  ? "e.g. Stage 4 — Burbank"
                  : kind === "filming_location"
                    ? "e.g. Downtown bridge — holding"
                    : "e.g. Truck 2 — Honeywagon"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={!name.trim()}>
            Save place
          </button>
          <QuickLocationPresets production={prod} />
        </form>
      </section>

      <section className="stack">
        <h2 className="muted" style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.08em" }}>
          Saved places ({prod.locations.length})
        </h2>
        {prod.locations.length === 0 ? (
          <p>No studios or trucks yet — add one above.</p>
        ) : (
          prod.locations.map((loc) => (
            <div key={loc.id} className="card row" style={{ justifyContent: "space-between", width: "100%" }}>
              <div className="stack" style={{ gap: "0.35rem", alignItems: "flex-start" }}>
                <span className={pillClass(loc.kind)}>{LOCATION_KIND_LABEL[loc.kind]}</span>
                <strong>{loc.name}</strong>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                style={{ minHeight: 40, padding: "0.35rem 0.65rem" }}
                onClick={() => {
                  if (window.confirm(`Remove "${loc.name}"? Past scans still show it in the log.`)) {
                    removeLocation(prod.id, loc.id);
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
