import { Link } from "react-router-dom";
import type { Production } from "@/types";

type Props = {
  production: Production;
  scanCount: number;
};

type Step = {
  done: boolean;
  label: string;
  detail: string;
  href: string;
};

export function SetupChecklistCard({ production, scanCount }: Props) {
  const needsPlaces = production.locations.length === 0;
  const needsInventory = production.items.length === 0;
  const needsFirstScan = scanCount === 0 && !needsPlaces && !needsInventory;

  if (needsPlaces || !needsFirstScan) return null;

  const steps: Step[] = [
    {
      done: false,
      label: "Run your first scan",
      href: "/scan",
      detail: "Dynamic QR or handwritten rental label — both hit the log.",
    },
  ];

  return (
    <section className="card stack setup-checklist" aria-label="Setup checklist">
      <h2 style={{ marginTop: 0 }}>Get ready for set</h2>
      <p style={{ marginBottom: 0 }}>Next: run your first scan. Tap below when you are ready.</p>
      <ul className="setup-checklist__list">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              to={step.href}
              className={`setup-checklist__row ${step.done ? "setup-checklist__row--done" : ""}`}
            >
              <span className="setup-checklist__mark" aria-hidden>
                ○
              </span>
              <span>
                <strong>{step.label}</strong>
                <span className="muted setup-checklist__detail">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
