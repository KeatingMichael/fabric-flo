import { useId, useMemo, useRef } from "react";

const CUSTOM = "__custom__";

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  helperText?: string;
};

export function InventoryNameField({
  id: idProp,
  label = "Name",
  value,
  onChange,
  options,
  placeholder = "Choose from list or type a new name",
  helperText,
}: Props) {
  const autoId = useId();
  const id = idProp ?? `inv-name-${autoId}`;
  const listId = `${id}-datalist`;
  const inputRef = useRef<HTMLInputElement>(null);

  const selectValue = useMemo(() => {
    const t = value.trim();
    if (!t) return "";
    if (options.some((n) => n === value)) return value;
    return CUSTOM;
  }, [value, options]);

  function onSelectChange(next: string) {
    if (next === CUSTOM) {
      onChange("");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    onChange(next);
  }

  return (
    <div className="field inventory-name-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={`${id}-select`}
        className="select"
        aria-label={`${label} — choose from list`}
        value={selectValue}
        onChange={(e) => onSelectChange(e.target.value)}
      >
        <option value="">
          {options.length > 0 && label.toLowerCase().includes("fabric")
            ? "Choose fabric type…"
            : "N/A — type a new name below"}
        </option>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        {options.length > 0 ? <option value={CUSTOM}>Type a different name…</option> : null}
      </select>
      <input
        ref={inputRef}
        id={id}
        className="input inventory-name-field__input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={options.length > 0 ? listId : undefined}
        autoComplete="off"
        aria-label={`${label} — type or edit`}
      />
      {options.length > 0 ? (
        <datalist id={listId}>
          {options.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      ) : null}
      {helperText ? (
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
