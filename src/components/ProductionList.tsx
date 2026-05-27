import { useMemo } from "react";
import type { Production } from "@/types";

type Props = {
  productions: Production[];
  activeProductionId: string | null;
  onSelect: (productionId: string) => void;
  onRemove?: (productionId: string) => void;
};

export function ProductionList({ productions, activeProductionId, onSelect, onRemove }: Props) {
  const sorted = useMemo(
    () => [...productions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [productions]
  );

  if (sorted.length === 0) return null;

  return (
    <div className="stack">
      {sorted.map((p) => {
        const isCurrent = p.id === activeProductionId;
        return (
          <div
            key={p.id}
            className="card production-list-row"
            style={{
              border: isCurrent ? "1px solid var(--accent)" : undefined,
            }}
          >
            <button
              type="button"
              className="btn-ghost production-list-row__open"
              onClick={() => onSelect(p.id)}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700 }}>{p.name}</span>
                {isCurrent ? (
                  <span
                    className="muted"
                    style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}
                  >
                    Current
                  </span>
                ) : null}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                {p.items.length} items · {p.locations.length} places
              </div>
            </button>
            {onRemove ? (
              <button
                type="button"
                className="btn btn-ghost production-list-row__remove"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Remove "${p.name}" and all of its scans on this device? This cannot be undone.`
                    )
                  ) {
                    return;
                  }
                  onRemove(p.id);
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
