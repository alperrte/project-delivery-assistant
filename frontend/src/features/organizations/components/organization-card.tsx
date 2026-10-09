"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarBlank, Globe, MapPin } from "@phosphor-icons/react";
import { EntityCard, EntityCardFooter, EntityCardLink, EntityCardSection, EntityStatusPill } from "@/components/common/entity-card";
import { EntityMark } from "@/components/common/entity-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { organizationImageSource } from "../api";
import type { Organization } from "../types";
import { OrganizationCover } from "./organization-cover";

export type OrganizationCardData = Pick<Organization, "id" | "name" | "description" | "status" | "updatedAt"> & Partial<Pick<Organization, "logoVersion" | "coverVersion" | "website" | "location">>;

/** Live preview on the create/edit page: the link is inert and the date is a label instead of a real timestamp. */
export type OrganizationCardPreview = { updatedLabel: string; logoSrc?: string | null; coverSrc?: string | null };

/** `https://example.com/` reads as `example.com` on the card; the full address lives on the organization page. */
function shortWebsite(website: string): string {
  return website.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/**
 * The organization as it looks in the Organizasyonlar list; the form page draws the very same card as its preview.
 * It sits on the shared EntityCard shell, so it has the Project card's width, header, section rhythm and footer.
 */
export function OrganizationCard({ organization, preview }: { organization: OrganizationCardData; preview?: OrganizationCardPreview }) {
  const t = useTranslations("organizations");
  const locale = useLocale();
  const active = organization.status === "ACTIVE";
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const name = organization.name.trim();
  const website = organization.website?.trim() ? shortWebsite(organization.website) : "";
  const location = organization.location?.trim() ?? "";

  const imageData = { id: organization.id, logoVersion: organization.logoVersion ?? null, coverVersion: organization.coverVersion ?? null };
  const logoSrc = preview ? preview.logoSrc ?? null : organizationImageSource(imageData, "logo");
  const coverSrc = preview ? preview.coverSrc ?? null : organizationImageSource(imageData, "cover");
  const updated = preview ? preview.updatedLabel : date.format(new Date(organization.updatedAt));

  return (
    <EntityCard
      tone={active ? "success" : "neutral"}
      banner={coverSrc ? <OrganizationCover key={coverSrc} src={coverSrc} className="aspect-auto size-full sm:aspect-auto" /> : undefined}
      mark={<EntityMark key={logoSrc ?? "none"} name={name} src={logoSrc} />}
      title={name || t("form.preview.namePlaceholder")}
      description={organization.description?.trim() || t("cardNoDescription")}
      badge={
        <EntityStatusPill
          className={active ? "border border-success/25 bg-success/10 text-success" : "border border-border bg-muted text-muted-foreground"}
          dotClassName={active ? "bg-success" : "bg-muted-foreground/40"}
          label={t(`statusValues.${organization.status}`)}
        />
      }
      className={preview ? "hover:translate-y-0 hover:border-border hover:shadow-none motion-safe:hover:translate-y-0" : undefined}
    >
      <EntityCardSection label={t("profile.website")}>
        <p className="flex min-h-8 min-w-0 items-center gap-2 text-sm">
          <Globe size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("min-w-0 truncate", website ? "text-foreground" : "text-muted-foreground")} title={website || undefined}>{website || "—"}</span>
        </p>
      </EntityCardSection>

      <EntityCardSection label={t("profile.location")}>
        <p className="flex min-h-8 min-w-0 items-center gap-2 text-sm">
          <MapPin size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("min-w-0 truncate", location ? "text-foreground" : "text-muted-foreground")} title={location || undefined}>{location || "—"}</span>
        </p>
      </EntityCardSection>

      <EntityCardSection label={t("card.lastUpdate")}>
        <p className="flex items-center gap-2 text-sm text-foreground">
          <CalendarBlank size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <time className="min-w-0 truncate" dateTime={preview ? undefined : organization.updatedAt} title={updated}>{updated}</time>
        </p>
      </EntityCardSection>

      <EntityCardFooter>
        {preview ? (
          <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-w-0 flex-1 justify-between px-3 opacity-60")}>
            {t("cardOpen")}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        ) : (
          <EntityCardLink href={`/organizations/${organization.id}`} label={t("cardOpen")} ariaLabel={t("card.openNamed", { name: organization.name })} />
        )}
      </EntityCardFooter>
    </EntityCard>
  );
}
