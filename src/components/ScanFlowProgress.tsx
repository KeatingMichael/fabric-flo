type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Label" },
  { n: 2, label: "Place" },
  { n: 3, label: "Done" },
];

export function ScanFlowProgress({ step }: { step: Step }) {
  return (
    <ol className="scan-flow" aria-label="Log progress">
      {STEPS.map(({ n, label }) => {
        const done = n < step;
        const active = n === step;
        return (
          <li
            key={n}
            className={`scan-flow__step${active ? " scan-flow__step--active" : ""}${done ? " scan-flow__step--done" : ""}`}
            aria-current={active ? "step" : undefined}
          >
            <span className="scan-flow__bar" />
            <span className="scan-flow__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
