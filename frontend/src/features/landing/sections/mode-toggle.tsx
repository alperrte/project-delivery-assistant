import styles from "../landing.module.css";

/** Two-way switch for a demo. Real buttons with `aria-pressed`, so it works with keyboard and screen readers and has no hidden state. */
export function ModeToggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className={styles.toggle}>
      {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} className={styles.toggleButton} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div>
  );
}
