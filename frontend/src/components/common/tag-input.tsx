"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { X } from "@phosphor-icons/react";

type TagInputProps = {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Accessible name of a tag's remove button. */
  removeLabel: (tag: string) => string;
  "aria-describedby"?: string;
};

/** Free-text tags: Enter or comma adds, Backspace on an empty field removes the last one. */
export function TagInput({ id, value, onChange, placeholder, removeLabel, "aria-describedby": describedBy }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const incoming = raw.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
    const next = [...value];
    for (const tag of incoming) {
      if (!next.some((existing) => existing.toLowerCase() === tag.toLowerCase())) next.push(tag);
    }
    if (next.length !== value.length) onChange(next);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 transition-colors hover:border-border-strong focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30"
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex max-w-full items-center gap-1 rounded-md border bg-surface-2 py-0.5 pr-1 pl-2 text-xs font-medium text-foreground"
        >
          <span className="truncate">{tag}</span>
          <button
            type="button"
            aria-label={removeLabel(tag)}
            onClick={() => onChange(value.filter((item) => item !== tag))}
            className="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={10} weight="bold" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={(event) => (/[,;]/.test(event.target.value) ? commit(event.target.value) : setDraft(event.target.value))}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : undefined}
        aria-describedby={describedBy}
        className="min-w-28 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-none!"
      />
    </div>
  );
}
