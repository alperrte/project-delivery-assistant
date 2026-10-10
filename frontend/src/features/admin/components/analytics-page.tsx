"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OptionGroup } from "@/features/settings/components/option-group";
import { useSession } from "@/features/auth/hooks/use-session";
import { cn } from "@/lib/utils";
import { adminApi, type AnalyticsDashboard, type TrafficSource } from "../api";
import { adminKeys } from "../query-keys";
import { BehaviorSections } from "./behavior-sections";
import { DailyChart } from "./charts";

type Preset = "7" | "30" | "90" | "custom";
const MAX_DAYS = 366;
const SOURCE_BAR: Record<TrafficSource, string> = {
  DIRECT: "bg-label-blue",
  SEARCH: "bg-label-teal",
  REFERRAL: "bg-label-amber",
  CAMPAIGN: "bg-label-violet",
};

const subscribeNever = () => () => {};

function localDay(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDay(date);
}
function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000) + 1;
}

/** "4 dk 32 sn": minutes and seconds in the viewer's language, never a bare number of seconds. */
export function formatDuration(totalSeconds: number, locale: string, zero: string) {
  const seconds = Math.max(Math.round(totalSeconds), 0);
  if (seconds === 0) return zero;
  const unit = (value: number, name: "minute" | "second") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "short" }).format(value);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const text = [minutes > 0 ? unit(minutes, "minute") : null, rest > 0 || minutes === 0 ? unit(rest, "second") : null].filter(Boolean).join(" ");
  // Turkish abbreviations read "4 dk 32 sn"; the locale data adds a full stop after each ("4 dk. 32 sn.").
  return locale.startsWith("tr") ? text.replaceAll(".", "") : text;
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function AdminAnalyticsPage() {
  const t = useTranslations("admin.analytics");
  const locale = useLocale();
  const ids = useId();
  const { data: me } = useSession();
  const actorId = me?.id;

  const [preset, setPreset] = useState<Preset>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // The browser's zone is sent explicitly, so "a day" means the same thing on the screen and in the numbers.
  // (Read after hydration only: the server render has no browser zone.)
  const zone = useSyncExternalStore(subscribeNever, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => null);
  const today = useSyncExternalStore(subscribeNever, () => localDay(new Date()), () => null);

  let range: { from: string; to: string } | null = null;
  let invalid = false;
  if (today) {
    if (preset === "custom") {
      if (customFrom && customTo) {
        invalid = customFrom > customTo || daysBetween(customFrom, customTo) > MAX_DAYS;
        range = invalid ? null : { from: customFrom, to: customTo };
      }
    } else {
      range = { from: addDays(today, -(Number(preset) - 1)), to: today };
    }
  }

  const query = useQuery({
    queryKey: adminKeys.analytics(actorId, { from: range?.from ?? "", to: range?.to ?? "", zone: zone ?? "" }),
    queryFn: ({ signal }) => adminApi.analytics({ from: range!.from, to: range!.to, zone: zone! }, signal),
    enabled: !!actorId && !!range && !!zone,
  });

  const data: AnalyticsDashboard | undefined = query.data;
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const fmt = (value: number) => number.format(value);
  const sourceTotal = data?.traffic.sources.reduce((sum, item) => sum + item.sessions, 0) ?? 0;

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-sm leading-none font-medium">{t("range.label")}</p>
          <OptionGroup<Preset>
            name="admin-range"
            label={t("range.label")}
            value={preset}
            onChange={setPreset}
            options={[
              { value: "7", label: t("range.days7") },
              { value: "30", label: t("range.days30") },
              { value: "90", label: t("range.days90") },
              { value: "custom", label: t("range.custom") },
            ]}
          />
        </div>
        {preset === "custom" && (
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            <DatePicker id="admin-range-from" label={t("range.from")} value={customFrom} onChange={setCustomFrom} invalid={invalid} describedBy={invalid ? `${ids}-invalid` : undefined} />
            <DatePicker id="admin-range-to" label={t("range.to")} value={customTo} onChange={setCustomTo} invalid={invalid} describedBy={invalid ? `${ids}-invalid` : undefined} />
          </div>
        )}
        {invalid && <p id={`${ids}-invalid`} role="alert" className="text-sm text-destructive">{t("range.invalid")}</p>}
        <p className="text-xs text-muted-foreground">
          {data && t("range.shown", { from: date.format(new Date(`${data.range.from}T12:00:00`)), to: date.format(new Date(`${data.range.to}T12:00:00`)), days: data.range.days })}
          {data && " · "}
          {zone && t("range.zone", { zone })}
        </p>
      </div>

      {query.isError ? (
        <div role="alert" className="mt-8 rounded-2xl border bg-card p-6">
          <p className="text-sm text-destructive">{t("error")}</p>
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => void query.refetch()}>{t("retry")}</Button>
        </div>
      ) : !data ? (
        <div role="status" aria-label={t("loading")} className="mt-8 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <>
          <Block id={`${ids}-overview`} title={t("sections.overview")}>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="overview">
              <Stat label={t("cards.visits")} value={fmt(data.traffic.visits)} hint={t("cards.fromConsented")} />
              <Stat label={t("cards.sessions")} value={fmt(data.traffic.uniqueSessions)} hint={t("cards.fromConsented")} />
              <Stat label={t("cards.engagement")} value={formatDuration(data.traffic.averageEngagedSeconds, locale, t("duration.zero"))} hint={t("cards.fromConsented")} />
              <Stat label={t("cards.registrations")} value={fmt(data.registrations.inRange)} hint={t("cards.fromRecords")} />
              <Stat label={t("cards.activeAccounts")} value={fmt(data.accounts.active)} hint={t("cards.fromRecords")} />
              <Stat label={t("cards.contactRequests")} value={fmt(data.contactRequests.inRange)} hint={t("cards.fromRecords")} />
            </dl>
          </Block>

          <Block id={`${ids}-traffic`} title={t("sections.traffic")}>
            {data.traffic.visits === 0 && <p className="mb-3 text-sm text-muted-foreground">{t("traffic.empty")}</p>}
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium">{t("traffic.visitsChart")}</h3>
              <DailyChart kind="line" label={t("traffic.visitsLabel")} points={data.traffic.daily.map((day) => ({ date: day.date, value: day.visits }))} />
              <p className="mt-2 text-sm text-muted-foreground">{t("traffic.visitors")}: <span className="font-medium tabular-nums text-foreground">{fmt(data.traffic.uniqueVisitors)}</span></p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border bg-card p-4">
                <h3 className="mb-3 text-sm font-medium">{t("traffic.sources")}</h3>
                {data.traffic.sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("traffic.empty")}</p>
                ) : (
                  <ul className="space-y-3">
                    {data.traffic.sources.map((item) => {
                      const share = sourceTotal === 0 ? 0 : Math.round((item.sessions / sourceTotal) * 100);
                      return (
                        <li key={item.source} data-source={item.source}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span>{t(`traffic.sourceNames.${item.source}`)}</span>
                            <span className="tabular-nums text-muted-foreground">{fmt(item.sessions)} · %{share}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
                            <div className={cn("h-full rounded-full", SOURCE_BAR[item.source])} style={{ width: `${Math.max(share, 2)}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">{t("traffic.sourceNote")}</p>
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <h3 className="mb-3 text-sm font-medium">{t("traffic.topReferrers")}</h3>
                {data.traffic.topReferrers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("traffic.noReferrers")}</p>
                ) : (
                  <Table aria-label={t("traffic.topReferrers")}>
                    <TableHeader><TableRow><TableHead scope="col">{t("traffic.domain")}</TableHead><TableHead scope="col" className="text-right">{t("traffic.sessions")}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.traffic.topReferrers.map((row) => (
                        <TableRow key={row.name}><TableCell className="max-w-56 truncate" title={row.name}>{row.name}</TableCell><TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium">{t("traffic.campaigns")}</h3>
              {data.traffic.topCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("traffic.noCampaigns")}</p>
              ) : (
                <Table aria-label={t("traffic.campaigns")}>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{t("traffic.campaign")}</TableHead>
                      <TableHead scope="col">{t("traffic.source")}</TableHead>
                      <TableHead scope="col">{t("traffic.medium")}</TableHead>
                      <TableHead scope="col" className="text-right">{t("traffic.sessions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.traffic.topCampaigns.map((row, index) => (
                      <TableRow key={`${row.campaign}-${row.source}-${row.medium}-${index}`}>
                        <TableCell className="max-w-48 truncate" title={row.campaign ?? ""}>{row.campaign ?? "—"}</TableCell>
                        <TableCell className="max-w-40 truncate">{row.source ?? "—"}</TableCell>
                        <TableCell className="max-w-40 truncate">{row.medium ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Block>

          {data.behavior && <BehaviorSections behavior={data.behavior} idPrefix={ids} />}

          <Block id={`${ids}-registrations`} title={t("sections.registrations")}>
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium">{t("registrations.chart")}</h3>
              <DailyChart kind="bar" label={t("registrations.label")} points={data.registrations.daily} />
              <p className="mt-2 text-sm text-muted-foreground">{t("registrations.total")}: <span className="font-medium tabular-nums text-foreground">{fmt(data.registrations.inRange)}</span></p>
            </div>
          </Block>

          <Block id={`${ids}-users`} title={t("sections.users")}>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="accounts">
              <Stat label={t("users.total")} value={fmt(data.accounts.total)} />
              <Stat label={t("users.active")} value={fmt(data.accounts.active)} />
              <Stat label={t("users.terminated")} value={fmt(data.accounts.terminated)} />
              <Stat label={t("users.pending")} value={fmt(data.accounts.pendingVerification)} />
              <Stat label={t("users.admins")} value={fmt(data.accounts.admins)} />
            </dl>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("users.note")}</p>
          </Block>

          <Block id={`${ids}-contact`} title={t("sections.contact")}>
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium">{t("contact.chart")}</h3>
              <DailyChart kind="bar" label={t("contact.label")} points={data.contactRequests.daily} />
              <p className="mt-2 text-sm text-muted-foreground">
                {t("contact.inRange")}: <span className="font-medium tabular-nums text-foreground">{fmt(data.contactRequests.inRange)}</span>
                {" · "}{t("contact.total")}: <span className="font-medium tabular-nums text-foreground">{fmt(data.contactRequests.total)}</span>
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("contact.note")}</p>
            </div>
          </Block>
        </>
      )}
    </div>
  );
}
