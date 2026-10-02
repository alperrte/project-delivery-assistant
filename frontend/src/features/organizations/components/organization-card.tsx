"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarBlank } from "@phosphor-icons/react";
import { EntityCard, EntityCardFooter, EntityCardLink, EntityCardSection, EntityStatusPill } from "@/components/common/entity-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Organization } from "../types";

export type OrganizationCardData = Pick<Organization, "id" | "name" | "description" | "status" | "updatedAt">;

/** Live preview on the create/edit page: the link is inert and the date is a label instead of a real timestamp. */
export type OrganizationCardPreview = { updatedLabel: string };

/** The organization as it looks in the Organizasyonlar list; the form page draws the very same card as its preview. */
export function OrganizationCard({ organization, preview }: { organization: OrganizationCardData; preview?: OrganizationCardPreview }) {
  const t = useTranslations("organizations");
  const locale = useLocale();
  const active = organization.status === "ACTIVE";
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const name = organization.name.trim();

  return (
    <EntityCard
      tone={active ? "success" : "neutral"}
      mark={(name.slice(0, 1) || "?").toLocaleUpperCase(locale)}
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
      <EntityCardSection label={t("card.lastUpdate")}>
        <p className="flex items-center gap-2 text-sm text-foreground">
          <CalendarBlank size={16} className="text-muted-foreground" aria-hidden="true" />
          {preview ? <span>{preview.updatedLabel}</span> : <time dateTime={organization.updatedAt}>{date.format(new Date(organization.updatedAt))}</time>}
        </p>
      </EntityCardSection>
      <EntityCardFooter>
        {preview ? (
          <span
            aria-disabled="true"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-w-0 flex-1 justify-between px-3 opacity-60")}
          >
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
