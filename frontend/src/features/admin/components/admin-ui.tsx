"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/features/repository/links";
import { cn } from "@/lib/utils";

/** The one failure panel of the administration screens: what failed, and a way to try again. */
export function ErrorPanel({ message, retryLabel, onRetry, className }: { message: string; retryLabel: string; onRetry: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-2xl border bg-card p-6", className)}>
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" className="mt-3 min-h-11" onClick={onRetry}>{retryLabel}</Button>
    </div>
  );
}

/** Placeholder rows while a list loads; announced once as a status. */
export function LoadingRows({ label, rows = 6, className }: { label: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("space-y-2", className)}>
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
    </div>
  );
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-label-blue/10 text-label-blue",
};

/** A status as words (never colour alone) in a tone that matches its meaning. */
export function ToneBadge({ tone, children, className, ...rest }: { tone: Tone; children: ReactNode; className?: string } & Omit<React.ComponentProps<"span">, "children" | "className">) {
  return <Badge variant="ghost" className={cn("hover:bg-transparent", TONES[tone], className)} {...rest}>{children}</Badge>;
}

/** Date and time helpers in the viewer's language; every value stays an absolute time with a relative hint on hover. */
export function useAdminDates() {
  const locale = useLocale();
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  return {
    dateTime: (iso: string) => dateTime.format(new Date(iso)),
    date: (iso: string) => date.format(new Date(iso)),
    relative: (iso: string) => relativeTime(iso, locale),
  };
}

/** One label/value pair of a definition list. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

/** A titled block of an admin page. The heading level is `h2`; the page title is the only `h1`. */
export function Section({ id, title, description, action, children, className }: { id: string; title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("mt-8", className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id={id} className="text-lg font-semibold">{title}</h2>
          {description && <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A labelled single-choice filter (a short fixed list, "all" included as an option). */
export function FilterSelect<T extends string>({ id, label, value, onChange, options, className }: {
  id: string;
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(next) => { if (next) onChange(next as T); }}>
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue>{(current: T) => options.find((option) => option.value === current)?.label ?? current}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
