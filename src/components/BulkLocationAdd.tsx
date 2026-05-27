import { useState } from "react";
import { useApp } from "@/context/AppStore";
import {
  BULK_LOCATION_PRESETS,
  generateBulkLocationNames,
  namesNotYetOnProduction,
  type BulkLocationPreset,
} from "@/lib/bulkLocations";
import type { Production } from "@/types";

type Props = {
  production: Production;
};

/** Optional one-tap shortcuts — hidden once the show has several places saved. */
export function QuickLocationPresets({ production }: Props) {
  const { addLocations } = useApp();
  const [msg, setMsg] = useState<string | null>(null);

  if (production.locations.length >= 6) return null;

  function onPreset(preset: BulkLocationPreset) {
    setMsg(null);
    const names = generateBulkLocationNames(preset.prefix, preset.start, preset.count);
    const { toAdd, skipped } = namesNotYetOnProduction(names, production.locations);
    if (!toAdd.length) {
      setMsg(`${preset.label} are already on your list.`);
      return;
    }
    const preview = toAdd.slice(0, 4).join(", ");
    const more = toAdd.length > 4 ? ` (+${toAdd.length - 4} more)` : "";
    const ok = window.confirm(
      `Add ${toAdd.length} ${preset.label.toLowerCase()}?\n\n${preview}${more}`
    );
    if (!ok) return;
    const added = addLocations(
      production.id,
      toAdd.map((name) => ({ kind: preset.kind, name }))
    );
    const note =
      skipped.length > 0 ? ` (${skipped.length} already existed, skipped)` : "";
    setMsg(`Added ${added} place${added === 1 ? "" : "s"}${note}.`);
  }

  return (
    <div className="quick-loc-presets" style={{ marginTop: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
      <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
        Optional shortcut — tap to add a common set:
      </p>
      <div className="quick-loc-presets__buttons">
        {BULK_LOCATION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.85rem", minHeight: 44 }}
            onClick={() => onPreset(preset)}
          >
            + {preset.label}
          </button>
        ))}
      </div>
      {msg ? (
        <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
          {msg}
        </p>
      ) : null}
    </div>
  );
}
