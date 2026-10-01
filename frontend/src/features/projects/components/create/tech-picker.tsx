"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MAX_TECH_SELECTION, TECH_CATALOG, canonicalTech, resolveTech, techGroupsFor, type TechItem } from "../../tech-catalog";
import type { ProjectType } from "../../types";
import { TechLogo } from "../tech-logo";

type TechPickerProps = {
  type: ProjectType | undefined;
  value: string[];
  onChange: (value: string[]) => void;
};

function TechChip({ label, logo, pressed, disabled, onToggle }: { label: string; logo?: TechItem; pressed: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled && !pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        pressed && "border-primary bg-primary/5",
      )}
    >
      {logo ? <TechLogo tech={logo} /> : null}
      {label}
    </button>
  );
}

export function TechPicker({ type, value, onChange }: TechPickerProps) {
  const t = useTranslations("projects.newPage.technology");
  const searchId = useId();
  const [query, setQuery] = useState("");
  const full = value.length >= MAX_TECH_SELECTION;
  const trimmed = query.trim().toLocaleLowerCase("en");

  const groups = useMemo(() => {
    if (trimmed) {
      const items = Object.values(TECH_CATALOG).filter((tech) => tech.name.toLocaleLowerCase("en").includes(trimmed));
      return [{ key: "all", items }];
    }
    return techGroupsFor(type);
  }, [trimmed, type]);

  const listed = new Set(groups.flatMap((group) => group.items.map((tech) => tech.name)));
  // Selections that the current type does not suggest (or free text from elsewhere) stay visible and removable.
  const others = trimmed ? [] : value.filter((label) => !listed.has(resolveTech(label)?.name ?? label));

  function toggle(name: string) {
    onChange(value.includes(name) ? value.filter((item) => item !== name) : canonicalTech([...value, name]));
  }

  const empty = groups.every((group) => group.items.length === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-64">
          <label htmlFor={searchId} className="sr-only">
            {t("search")}
          </label>
          <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 pl-9"
          />
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {t("selected", { count: value.length, max: MAX_TECH_SELECTION })}
        </p>
      </div>

      {empty && <p className="text-sm text-muted-foreground">{t("noResults")}</p>}

      {groups.map((group) =>
        group.items.length === 0 ? null : (
          <fieldset key={group.key} className="space-y-2">
            <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t(`categories.${group.key}`)}</legend>
            <div className="flex flex-wrap gap-2">
              {group.items.map((tech) => (
                <TechChip key={tech.id} label={tech.name} logo={tech} pressed={value.includes(tech.name)} disabled={full} onToggle={() => toggle(tech.name)} />
              ))}
            </div>
          </fieldset>
        ),
      )}

      {others.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("otherSelections")}</legend>
          <div className="flex flex-wrap gap-2">
            {others.map((label) => (
              <TechChip key={label} label={label} logo={resolveTech(label) ?? undefined} pressed disabled={full} onToggle={() => toggle(label)} />
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
