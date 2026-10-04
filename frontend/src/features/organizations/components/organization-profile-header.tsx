"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EntityMark } from "@/components/common/entity-mark";
import { EntityStatusPill } from "@/components/common/entity-card";
import { cn } from "@/lib/utils";
import { OrganizationCover } from "./organization-cover";
export function OrganizationProfileHeader({ name, description, logoSrc, coverSrc, preview = false, centered = false, action }: {
 name: string; description: string | null; logoSrc: string | null; coverSrc: string | null; preview?: boolean; centered?: boolean; action?: ReactNode;
}) {
 const t = useTranslations("organizations"); const Heading = preview ? "h3" : "h1";
 return <div className="overflow-hidden rounded-xl border bg-card">
  <OrganizationCover src={coverSrc} className={cn("h-24 aspect-auto sm:aspect-auto",!centered && "h-16")} />
  <div className={cn("relative flex flex-wrap items-start gap-4 p-5",centered && "flex-col items-center pt-0 text-center")}>
   <span aria-hidden="true" className={cn("-mt-8 grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-strong bg-card text-2xl font-semibold shadow-sm",centered && "-mt-16")}><EntityMark name={name} src={logoSrc} /></span>
   <div className="min-w-0 flex-1"><Heading className={cn("break-words text-xl font-semibold",preview && "text-base")}>{name.trim() || t("form.preview.namePlaceholder")}</Heading><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">{description?.trim() || t("cardNoDescription")}</p></div>
   {centered && <EntityStatusPill className="border border-success/25 bg-success/10 text-success" dotClassName="bg-success" label={t("statusValues.ACTIVE")}/>}
   {action && <div className="flex flex-wrap gap-2">{action}</div>}
  </div>
 </div>;
}
