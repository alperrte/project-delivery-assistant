"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, Clock, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pad = (value: number) => String(value).padStart(2, "0");

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hour: match[1], minute: match[2] } : null;
}

type TimePickerProps = {
  id: string;
  label: string;
  /** 24-hour "HH:mm", or "" when no time is set. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Minute increment shown in the minute column. Defaults to 5. */
  minuteStep?: number;
};

/** Optional 24-hour time, using the same Base UI popover, button and semantic tokens as `DatePicker`. */
export function TimePicker({ id, label, value, onChange, onBlur, ref, disabled, invalid, describedBy, minuteStep = 5 }: TimePickerProps) {
  const locale = useLocale();
  const t = useTranslations("timePicker");
  const [open, setOpen] = useState(false);
  const step = Number.isFinite(minuteStep) ? Math.min(60, Math.max(1, Math.floor(minuteStep))) : 5;
  const parsed = parseTime(value);
  const formatted = parsed
    ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(2000, 0, 1, Number(parsed.hour), Number(parsed.minute)))
    : t("placeholder");

  const hours = Array.from({ length: 24 }, (_, index) => pad(index));
  const minuteValues = Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step).filter(minute => minute < 60);
  if (parsed && !minuteValues.includes(Number(parsed.minute))) minuteValues.push(Number(parsed.minute));
  const minutes = minuteValues.sort((a, b) => a - b).map(pad);

  function chooseHour(hour: string) {
    onChange(`${hour}:${parsed?.minute ?? "00"}`);
  }
  function chooseMinute(minute: string) {
    onChange(`${parsed?.hour ?? pad(new Date().getHours())}:${minute}`);
  }
  function chooseNow() {
    const now = new Date();
    onChange(`${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / step) * step)}`);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        ref={ref}
        aria-label={`${label}: ${formatted}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onBlur={onBlur}
        render={<Button type="button" variant="outline" disabled={disabled} className="h-10 w-full min-w-0 shrink justify-start gap-2.5 px-3 font-normal" />}
      >
        <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className={cn("min-w-0 flex-1 truncate text-left tabular-nums", !parsed && "text-muted-foreground")}>{formatted}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={12} className="z-50">
          <Popover.Popup
            aria-label={label}
            initialFocus={() => document.getElementById(`${id}-time`)?.querySelector<HTMLElement>('[role="option"][tabindex="0"]') ?? true}
            className="max-h-(--available-height) w-[min(16rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl outline-none"
          >
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <Popover.Title className="text-sm font-medium">{label}</Popover.Title>
              <Popover.Close render={<Button type="button" variant="ghost" size="icon-sm" aria-label={t("close")} />}>
                <X className="size-4" aria-hidden="true" />
              </Popover.Close>
            </div>
            {open && (
              <div id={`${id}-time`} className="grid grid-cols-2 gap-2">
                <TimeColumn label={t("hour")} dataKey="data-hour" options={hours} selected={parsed?.hour ?? null} onSelect={chooseHour} />
                <TimeColumn label={t("minute")} dataKey="data-minute" options={minutes} selected={parsed?.minute ?? null} onSelect={chooseMinute} />
              </div>
            )}
            <div className="sticky bottom-0 mt-3 flex items-center justify-between gap-2 border-t border-border bg-popover pt-3">
              <Button type="button" variant="secondary" className="h-9" onClick={chooseNow}>{t("now")}</Button>
              <Button type="button" variant="ghost" className="h-9 text-muted-foreground" disabled={!parsed} onClick={() => { onChange(""); setOpen(false); }}>{t("clear")}</Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function TimeColumn({ label, dataKey, options, selected, onSelect }: {
  label: string;
  dataKey: "data-hour" | "data-minute";
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(selected);
  // Roving tabindex: the selected option, else the first one, is the single tab stop of the column.
  const tabStop = active !== null && options.includes(active) ? active : selected ?? options[0];

  // Center the selected option when the popup opens (scrollTop keeps the page and popup from scrolling).
  useLayoutEffect(() => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (list && option) list.scrollTop = option.offsetTop - list.clientHeight / 2 + option.offsetHeight / 2;
  }, []);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowDown": next = Math.min(options.length - 1, index + 1); break;
      case "ArrowUp": next = Math.max(0, index - 1); break;
      case "Home": next = 0; break;
      case "End": next = options.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setActive(options[next]);
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus();
  }

  return (
    <div className="min-w-0">
      <p className="mb-1 px-1 text-center text-xs font-medium text-muted-foreground">{label}</p>
      <div ref={listRef} role="listbox" aria-label={label} className="relative max-h-56 overflow-y-auto rounded-lg border border-border bg-muted/30 p-1">
        {options.map((option, index) => {
          const isSelected = option === selected;
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={isSelected}
              tabIndex={option === tabStop ? 0 : -1}
              {...{ [dataKey]: option }}
              className={cn("flex min-h-10 w-full items-center justify-center rounded-lg text-sm tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-popover",
                isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90")}
              onFocus={() => setActive(option)}
              onKeyDown={event => navigate(event, index)}
              onClick={() => { setActive(option); onSelect(option); }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
