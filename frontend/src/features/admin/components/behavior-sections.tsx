"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BehaviorReport } from "../api";
import { Section } from "./admin-ui";

/** A route template as text. Long ones are cut visually; the whole value stays in the tooltip and for screen readers. */
function Path({ value }: { value: string }) {
  return <span className="block max-w-56 truncate font-mono text-xs sm:max-w-72" title={value}>{value}</span>;
}

function Panel({ title, empty, isEmpty, children, testId }: { title: string; empty: string; isEmpty: boolean; children: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0 space-y-2" data-testid={testId}>
      <h3 className="text-sm font-medium">{title}</h3>
      {isEmpty ? <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">{empty}</p> : children}
    </div>
  );
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

/**
 * What visitors did on the public site, from consented and anonymous analytics only: the most viewed, entry and exit
 * pages, the first step of a visit, missing pages, call-to-action clicks, registration conversions and client errors.
 * Pages are route templates; there is no per-visitor row anywhere in this block.
 */
export function BehaviorSections({ behavior, idPrefix }: { behavior: BehaviorReport; idPrefix: string }) {
  const t = useTranslations("admin.analytics.behavior");
  const tt = useTranslations("admin.analytics.traffic");
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale);
  const fmt = (value: number) => number.format(value);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const rate = (converted: number, sessions: number) => (sessions > 0 ? percent.format(converted / sessions) : "—");
  const named = (group: "ctaNames" | "errorKinds", id: string) => (t.has(`${group}.${id}`) ? t(`${group}.${id}`) : id);
  const { conversions, clientErrors } = behavior;
  const empty = t("empty");

  return (
    <>
      <Section id={`${idPrefix}-pages`} title={t("sections.pages")} description={t("pages.note")} className="mt-10">
        <div className="space-y-4">
          <Panel title={t("pages.top")} empty={empty} isEmpty={behavior.topPages.length === 0} testId="top-pages">
            <Table aria-label={t("pages.top")}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("columns.page")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("columns.views")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("columns.sessions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {behavior.topPages.map((row) => (
                  <TableRow key={row.path}>
                    <TableCell><Path value={row.path} /></TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.views)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("pages.entry")} empty={empty} isEmpty={behavior.entryPages.length === 0} testId="entry-pages">
              <Table aria-label={t("pages.entry")}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("columns.page")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("columns.sessions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {behavior.entryPages.map((row) => (
                    <TableRow key={row.path}>
                      <TableCell><Path value={row.path} /></TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
            <Panel title={t("pages.exit")} empty={empty} isEmpty={behavior.exitPages.length === 0} testId="exit-pages">
              <Table aria-label={t("pages.exit")}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("columns.page")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("columns.sessions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {behavior.exitPages.map((row) => (
                    <TableRow key={row.path}>
                      <TableCell><Path value={row.path} /></TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </div>
        </div>
      </Section>

      <Section id={`${idPrefix}-flows`} title={t("sections.flows")} description={t("flows.note")} className="mt-10">
        <Panel title={t("flows.title")} empty={empty} isEmpty={behavior.flows.length === 0} testId="flows">
          <Table aria-label={t("flows.title")}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("flows.from")}</TableHead>
                <TableHead scope="col">{t("flows.to")}</TableHead>
                <TableHead scope="col" className="text-right">{t("columns.sessions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {behavior.flows.map((row) => (
                <TableRow key={`${row.fromPath}>${row.toPath}`}>
                  <TableCell><Path value={row.fromPath} /></TableCell>
                  <TableCell><Path value={row.toPath} /></TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Section>

      <Section id={`${idPrefix}-notfound`} title={t("sections.notFound")} description={t("notFound.note")} className="mt-10">
        <dl className="grid gap-3 sm:grid-cols-2" data-testid="not-found">
          <Stat label={t("notFound.views")} value={fmt(behavior.notFound.views)} />
          <Stat label={t("notFound.sessions")} value={fmt(behavior.notFound.sessions)} />
        </dl>
      </Section>

      <Section id={`${idPrefix}-ctas`} title={t("sections.ctas")} description={t("ctas.note")} className="mt-10">
        <Panel title={t("ctas.title")} empty={empty} isEmpty={behavior.ctas.length === 0} testId="ctas">
          <Table aria-label={t("ctas.title")}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t("ctas.cta")}</TableHead>
                <TableHead scope="col" className="text-right">{t("ctas.clicks")}</TableHead>
                <TableHead scope="col" className="text-right">{t("columns.sessions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {behavior.ctas.map((row) => (
                <TableRow key={row.ctaId} data-cta={row.ctaId}>
                  <TableCell className="font-medium">{named("ctaNames", row.ctaId)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Section>

      <Section id={`${idPrefix}-conversion`} title={t("sections.conversion")} description={t("conversion.note")} className="mt-10">
        <dl className="grid gap-3 sm:grid-cols-3" data-testid="conversion">
          <Stat label={t("conversion.sessions")} value={fmt(conversions.sessions)} />
          <Stat label={t("conversion.converted")} value={fmt(conversions.converted)} />
          <Stat label={t("conversion.rate")} value={rate(conversions.converted, conversions.sessions)} />
        </dl>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title={t("conversion.bySource")} empty={empty} isEmpty={conversions.bySource.length === 0} testId="conversion-source">
            <Table aria-label={t("conversion.bySource")}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{tt("source")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("columns.sessions")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("conversion.converted")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("conversion.rate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions.bySource.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell>{tt(`sourceNames.${row.source}`)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.converted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rate(row.converted, row.sessions)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Panel title={t("conversion.byCampaign")} empty={empty} isEmpty={conversions.byCampaign.length === 0} testId="conversion-campaign">
            <Table aria-label={t("conversion.byCampaign")}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{tt("campaign")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("columns.sessions")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("conversion.converted")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("conversion.rate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions.byCampaign.map((row, index) => {
                  const label = row.campaign ?? "—";
                  const detail = [row.source, row.medium].filter(Boolean).join(" / ");
                  return (
                    <TableRow key={`${row.campaign}-${row.source}-${row.medium}-${index}`}>
                      <TableCell className="max-w-48">
                        <span className="block truncate" title={label}>{label}</span>
                        {detail && <span className="block truncate text-xs text-muted-foreground" title={detail}>{detail}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.sessions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.converted)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rate(row.converted, row.sessions)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
        </div>
      </Section>

      <Section id={`${idPrefix}-errors`} title={t("sections.errors")} description={t("errors.note")} className="mt-10">
        <dl className="grid gap-3 sm:grid-cols-2" data-testid="client-errors">
          <Stat label={t("errors.total")} value={fmt(clientErrors.total)} />
        </dl>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title={t("errors.byKind")} empty={empty} isEmpty={clientErrors.byKind.length === 0} testId="errors-kind">
            <Table aria-label={t("errors.byKind")}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("errors.kind")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("errors.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientErrors.byKind.map((row) => (
                  <TableRow key={row.kind}>
                    <TableCell>{named("errorKinds", row.kind)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
          <Panel title={t("errors.byRoute")} empty={empty} isEmpty={clientErrors.byRoute.length === 0} testId="errors-route">
            <Table aria-label={t("errors.byRoute")}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("columns.page")}</TableHead>
                  <TableHead scope="col">{t("errors.kind")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("errors.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientErrors.byRoute.map((row) => (
                  <TableRow key={`${row.path}-${row.kind}`}>
                    <TableCell><Path value={row.path} /></TableCell>
                    <TableCell>{named("errorKinds", row.kind)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </div>
      </Section>
    </>
  );
}
