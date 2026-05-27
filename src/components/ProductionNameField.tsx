type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
};

export function ProductionNameField({ id, value, onChange, optional }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>
        Production name{optional ? " (optional)" : ""}
      </label>
      <input
        id={id}
        className="input"
        placeholder="e.g. Night Bridge — Episode 3"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {optional ? (
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
          Joining with a code? You can leave this blank.
        </p>
      ) : (
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
          Working title or rental house job name.
        </p>
      )}
    </div>
  );
}
