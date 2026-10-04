"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarBlank } from "@phosphor-icons/react";
import { EntityCardFooter, EntityCardLink, EntityStatusPill } from "@/components/common/entity-card";
import { EntityMark } from "@/components/common/entity-mark";
import { EntityCover } from "@/components/common/entity-cover";
import { organizationImageSource } from "../api";
import type { Organization } from "../types";

export type OrganizationCardData = Pick<Organization, "id" | "name" | "description" | "status" | "updatedAt"> & Partial<Pick<Organization, "logoVersion" | "coverVersion">>;

/** Live preview on the create/edit page: the link is inert and the date is a label instead of a real timestamp. */
export type OrganizationCardPreview = { updatedLabel: string; logoSrc?: string | null; coverSrc?: string | null };

/** The organization as it looks in the Organizasyonlar list; the form page draws the very same card as its preview. */
export function OrganizationCard({ organization, preview }: { organization: OrganizationCardData; preview?: OrganizationCardPreview }) {
  const t = useTranslations("organizations");
  const locale = useLocale();
  const active = organization.status === "ACTIVE";
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const name = organization.name.trim();

  const imageData = { id: organization.id, logoVersion: organization.logoVersion ?? null, coverVersion: organization.coverVersion ?? null };
  const logoSrc = preview ? preview.logoSrc ?? null : organizationImageSource(imageData, "logo");
  const coverSrc = preview ? preview.coverSrc ?? null : organizationImageSource(imageData, "cover");

  return (
    <article className="relative overflow-hidden rounded-xl border bg-card">
      <div className="relative flex min-w-0 flex-wrap items-center gap-3 p-4">
        {coverSrc && <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-10"><EntityCover src={coverSrc} className="h-full aspect-auto sm:aspect-auto"/></div>}
        <span aria-hidden="true" className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-strong bg-label-blue/10 text-xl font-semibold"><EntityMark name={name} src={logoSrc}/></span>
        <div className="relative min-w-0 flex-1"><h2 className="truncate text-sm font-semibold" title={name}>{name || t("form.preview.namePlaceholder")}</h2><p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{organization.description?.trim() || t("cardNoDescription")}</p></div>
        <div className="relative"><EntityStatusPill className={active ? "border border-success/25 bg-success/10 text-success" : "border border-border bg-muted text-muted-foreground"} dotClassName={active ? "bg-success" : "bg-muted-foreground/40"} label={t(`statusValues.${organization.status}`)}/></div>
      </div>
      {!preview && <div className="border-t px-4 pb-4 pt-3"><p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarBlank size={14} aria-hidden="true"/>{t("card.lastUpdate")} <time dateTime={organization.updatedAt}>{date.format(new Date(organization.updatedAt))}</time></p><EntityCardFooter><EntityCardLink href={`/organizations/${organization.id}`} label={t("cardOpen")} ariaLabel={t("card.openNamed",{name:organization.name})}/></EntityCardFooter></div>}
    </article>
  );
}
