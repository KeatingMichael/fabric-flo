import type { NamedLocation } from "@/types";
import { LOCATION_KIND_LABEL } from "@/types";

type Props = {
  locations: NamedLocation[];
  recentIds: string[];
  selectedId: string;
  onPick: (id: string) => void;
};

export function RecentLocationChips({ locations, recentIds, selectedId, onPick }: Props) {
  const recent = recentIds
    .map((id) => locations.find((l) => l.id === id))
    .filter((l): l is NamedLocation => Boolean(l));

  if (!recent.length) return null;

  return (
    <div className="stack" style={{ gap: "0.45rem" }}>
      <span className="muted" style={{ fontSize: "0.82rem" }}>
        Recent — tap to fill location
      </span>
      <div className="recent-loc-chips" role="group" aria-label="Recent locations">
        {recent.map((loc) => {
          const active = loc.id === selectedId;
          return (
            <button
              key={loc.id}
              type="button"
              className={`recent-loc-chip ${active ? "recent-loc-chip--active" : ""}`}
              onClick={() => onPick(loc.id)}
            >
              <span className="recent-loc-chip__name">{loc.name}</span>
              <span className="recent-loc-chip__kind">{LOCATION_KIND_LABEL[loc.kind]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
