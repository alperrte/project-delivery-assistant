"use client";

import { useTranslations } from "next-intl";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@/components/ui/radio-group";
import { PROJECT_TYPES, type ProjectType } from "../../types";
import { PROJECT_TYPE_ICONS } from "../project-type";

type TypePickerProps = {
  value: ProjectType | undefined;
  onChange: (value: ProjectType) => void;
  labelledBy: string;
  invalid?: boolean;
};

export function TypePicker({ value, onChange, labelledBy, invalid }: TypePickerProps) {
  const t = useTranslations("projects.newPage.types");

  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={(next) => onChange(next as ProjectType)}
      aria-labelledby={labelledBy}
      aria-invalid={invalid}
      className="grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
    >
      {PROJECT_TYPES.map((type) => {
        const TypeIcon = PROJECT_TYPE_ICONS[type];
        return (
          <Radio.Root
            key={type}
            value={type}
            className="group flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left outline-none transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-primary data-checked:bg-primary/5"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground transition-colors group-data-checked:bg-primary group-data-checked:text-primary-foreground">
              <TypeIcon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{t(`${type}.name`)}</span>
              <span className="block text-xs leading-5 text-muted-foreground">{t(`${type}.description`)}</span>
            </span>
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}
