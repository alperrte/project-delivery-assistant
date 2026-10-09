"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Calendar dates stay local; UTC conversion can move a selected date by a day.
function localDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  return date;
}
function dateKey(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = localDate(year, month - 1, day);
  return year >= 1 && dateKey(date) === value ? date : null;
}
function changeMonth(date: Date, month: number, year = date.getFullYear()) {
  const first = localDate(year, month, 1);
  const last = localDate(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return localDate(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), last));
}

// Range bounds are plain YYYY-MM-DD strings, so lexicographic comparison matches calendar order.
function validKey(value?: string) {
  return value && parseDate(value) ? value : null;
}
function clampDate(date: Date, minKey: string | null, maxKey: string | null) {
  const key = dateKey(date);
  if (minKey && key < minKey) return parseDate(minKey) ?? date;
  if (maxKey && key > maxKey) return parseDate(maxKey) ?? date;
  return date;
}

type DatePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  ref?: Ref<HTMLButtonElement>;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Earliest selectable day (YYYY-MM-DD). Earlier days are disabled. */
  min?: string;
  /** Latest selectable day (YYYY-MM-DD). Later days are disabled. */
  max?: string;
};

/** Optional date, using the same Base UI focus/dismissal and semantic tokens as other popups. */
export function DatePicker({ id, label, value, onChange, onBlur, ref, disabled, invalid, describedBy, min, max }: DatePickerProps) {
  const locale = useLocale();
  const t = useTranslations("datePicker");
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  const formatted = selected ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(selected) : t("placeholder");
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
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className={cn("min-w-0 flex-1 truncate text-left", !selected && "text-muted-foreground")}>{formatted}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={12} className="z-50">
          <Popover.Popup
            aria-label={label}
            initialFocus={() => document.getElementById(`${id}-calendar`)?.querySelector<HTMLElement>("[data-focused-day]") ?? true}
            className="max-h-(--available-height) w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl outline-none"
          >
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <Popover.Title className="text-sm font-medium">{label}</Popover.Title>
              <Popover.Close render={<Button type="button" variant="ghost" size="icon-sm" aria-label={t("close")} />}>
                <X className="size-4" aria-hidden="true" />
              </Popover.Close>
            </div>
            {open && <DateCalendar id={`${id}-calendar`} value={value} min={min} max={max} onChoose={(next) => { onChange(next); setOpen(false); }} />}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DateCalendar({ id, value, min, max, onChoose }: { id: string; value: string; min?: string; max?: string; onChoose: (value: string) => void }) {
  const locale = useLocale();
  const t = useTranslations("datePicker");
  const [today] = useState(() => localDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const minKey = validKey(min);
  const maxKey = validKey(max);
  const clamp = (date: Date) => clampDate(date, minKey, maxKey);
  const outOfRange = (key: string) => Boolean((minKey && key < minKey) || (maxKey && key > maxKey));
  const [focused, setFocused] = useState(() => clamp(parseDate(value) ?? today));
  const focusRef = useRef<HTMLButtonElement>(null);
  const focusRequested = useRef(false);
  const focusedKey = dateKey(focused);
  const year = focused.getFullYear();
  const month = focused.getMonth();
  const monthTitle = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(focused);
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale, { month: "long" }).format(localDate(2024, index, 1)));
  // Without min/max this is the historical +-100 year window; with them the list is limited to the allowed span.
  const minYear = minKey ? Number(minKey.slice(0, 4)) : null;
  const maxYear = maxKey ? Number(maxKey.slice(0, 4)) : null;
  const firstYear = minYear ?? Math.min(today.getFullYear() - 100, maxYear ?? today.getFullYear() - 100);
  const lastYear = maxYear ?? Math.max(today.getFullYear() + 100, minYear ?? today.getFullYear() + 100);
  const years = Array.from(new Set([year, ...Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)])).filter(y => y >= 1 && y <= 9999).sort((a, b) => a - b);
  const monthOptions = months.map((name, index) => {
    const monthStart = dateKey(localDate(year, index, 1));
    const monthEnd = dateKey(localDate(year, index + 1, 0));
    return { value: String(index), label: name, disabled: Boolean((minKey && monthEnd < minKey) || (maxKey && monthStart > maxKey)) };
  });
  const previousDisabled = (year === 1 && month === 0) || Boolean(minKey && dateKey(localDate(year, month, 0)) < minKey);
  const nextDisabled = (year === 9999 && month === 11) || Boolean(maxKey && dateKey(localDate(year, month + 1, 1)) > maxKey);
  const todayKey = dateKey(today);
  const first = localDate(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => localDate(year, month, index - offset + 1));
  const weekdays = Array.from({ length: 7 }, (_, index) => localDate(2024, 0, index + 1)); // Monday first for TR/EN/DE.

  useLayoutEffect(() => {
    if (focusRequested.current) { focusRef.current?.focus(); focusRequested.current = false; }
  }, [focusedKey]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    let next: Date;
    switch (event.key) {
      case "ArrowLeft": next = localDate(year, month, date.getDate() - 1); break;
      case "ArrowRight": next = localDate(year, month, date.getDate() + 1); break;
      case "ArrowUp": next = localDate(year, month, date.getDate() - 7); break;
      case "ArrowDown": next = localDate(year, month, date.getDate() + 7); break;
      case "Home": next = localDate(year, month, date.getDate() - (date.getDay() + 6) % 7); break;
      case "End": next = localDate(year, month, date.getDate() + 6 - (date.getDay() + 6) % 7); break;
      case "PageUp": next = changeMonth(date, month - (event.shiftKey ? 12 : 1)); break;
      case "PageDown": next = changeMonth(date, month + (event.shiftKey ? 12 : 1)); break;
      default: return;
    }
    event.preventDefault();
    if (next.getFullYear() < 1 || next.getFullYear() > 9999) return;
    next = clamp(next); // Focus stays on selectable days; out-of-range days are disabled and never focusable.
    if (dateKey(next) === dateKey(date)) return;
    focusRequested.current = true;
    setFocused(next);
  }

  return (
    <div id={id}>
      <div className="mb-3 flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={t("previousMonth")} disabled={previousDisabled} onClick={() => setFocused(clamp(changeMonth(focused, month - 1)))}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          <CalendarSelect label={t("month")} value={month} onChange={next => setFocused(clamp(changeMonth(focused, next)))}
            options={monthOptions} />
          <CalendarSelect label={t("year")} value={year} onChange={next => setFocused(clamp(changeMonth(focused, month, next)))}
            options={years.map(item => ({ value: String(item), label: String(item) }))} />
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={t("nextMonth")} disabled={nextDisabled} onClick={() => setFocused(clamp(changeMonth(focused, month + 1)))}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">{monthTitle}</p>
      <table role="grid" aria-label={monthTitle} className="w-full table-fixed border-collapse">
        <thead><tr>
          {weekdays.map(day => <th key={day.getDay()} scope="col" className="pb-2 text-center text-xs font-medium text-muted-foreground">
            <abbr className="no-underline" title={new Intl.DateTimeFormat(locale, { weekday: "long" }).format(day)}>{new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day)}</abbr>
          </th>)}
        </tr></thead>
        <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>
          {days.slice(week * 7, week * 7 + 7).map(day => {
            const key = dateKey(day);
            const selected = key === value;
            const isToday = key === todayKey;
            const isFocused = key === focusedKey;
            const unavailable = outOfRange(key);
            return <td key={key} aria-selected={selected} className="p-0.5">
              <button type="button" ref={isFocused ? focusRef : undefined} tabIndex={isFocused ? 0 : -1} data-focused-day={isFocused || undefined} data-date={key}
                aria-label={unavailable ? `${fullDate.format(day)} – ${t("outOfRange")}` : fullDate.format(day)} aria-current={isToday ? "date" : undefined} disabled={unavailable || day.getFullYear() < 1 || day.getFullYear() > 9999}
                className={cn("relative flex aspect-square w-full items-center justify-center rounded-lg text-sm tabular-nums outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-popover disabled:opacity-30",
                  day.getMonth() !== month && "text-muted-foreground", isToday && !selected && "bg-accent font-semibold", selected && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90")}
                onKeyDown={event => navigate(event, day)} onClick={() => onChoose(key)}>
                {day.getDate()}
                {isToday && <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-current" />}
              </button>
            </td>;
          })}
        </tr>)}</tbody>
      </table>
      <div className="sticky bottom-0 mt-3 flex items-center justify-between gap-2 border-t border-border bg-popover pt-3">
        <Button type="button" variant="secondary" className="h-9" disabled={outOfRange(todayKey)} onClick={() => onChoose(todayKey)}>{t("today")}</Button>
        <Button type="button" variant="ghost" className="h-9 text-muted-foreground" disabled={!value} onClick={() => onChoose("")}>{t("clear")}</Button>
      </div>
    </div>
  );
}

function CalendarSelect({ label, value, onChange, options }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return <div className="min-w-0">
    <Select value={String(value)} items={options} modal={false} onValueChange={next => { if (next !== null) onChange(Number(next)); }}>
      <SelectTrigger aria-label={label} className="min-w-0 max-w-full gap-2 border-border bg-muted/40 px-2 font-medium hover:bg-muted">
        <SelectValue className="truncate" />
      </SelectTrigger>
      <SelectContent listProps={{ "aria-label": label }} align="start" alignItemWithTrigger={false} className="max-h-[min(18rem,var(--available-height))] p-1">
        {options.map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled} className="min-h-10">{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
