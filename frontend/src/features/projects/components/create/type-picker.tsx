"use client";

import { useTranslations } from "next-intl";
import { PROJECT_TYPES, type ProjectType } from "../../types";
import { PROJECT_TYPE_ICONS } from "../project-type";

type TypePickerProps = {
  value: readonly (ProjectType | undefined)[] | undefined;
  onChange: (value: ProjectType[]) => void;
  labelledBy: string;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
  /** Lets the form move focus here when this is the first field with an error. */
  id?: string;
};

export function TypePicker({ value, onChange, labelledBy, invalid, id, describedBy, onBlur }: TypePickerProps) {
  const t = useTranslations("projects.newPage.types");

  return (
    <div
      role="group"
      id={id}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onBlur={onBlur}
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
    >
      {PROJECT_TYPES.map((type) => {
        const TypeIcon = PROJECT_TYPE_ICONS[type];
        return (
          <label
            key={type}
            className="group flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:border-border-strong has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground transition-colors group-has-[:checked]:bg-primary group-has-[:checked]:text-primary-foreground">
              <TypeIcon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{t(`${type}.name`)}</span>
              <span className="block text-xs leading-5 text-muted-foreground">{t(`${type}.description`)}</span>
            </span>
            <input
              type="checkbox"
              value={type}
              checked={value?.includes(type) ?? false}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={event => onChange(PROJECT_TYPES.filter(item => item === type ? event.target.checked : value?.includes(item)))}
              className="mt-1 ml-auto size-4 shrink-0 accent-primary"
            />
          </label>
        );
      })}
    </div>
  );
}
