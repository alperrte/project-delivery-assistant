"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { EntityMark } from "@/components/common/entity-mark";
import { EntityStatusPill } from "@/components/common/entity-card";
import { cn } from "@/lib/utils";
import { OrganizationCover } from "./organization-cover";
export function OrganizationProfileHeader({ name, description, logoSrc, coverSrc, preview = false, centered = false, badge, corner }: {
 name: string; description: string | null; logoSrc: string | null; coverSrc: string | null; preview?: boolean; centered?: boolean;
 /** Shown next to the name (the page; the form's centered preview draws its own pill). */
 badge?: ReactNode;
 /** Controls pinned to the top-right corner of the cover, like the edit pencil on a project card. */
 corner?: ReactNode;
}) {
 const t = useTranslations("organizations"); const Heading = preview ? "h3" : "h1";
 return <div className="relative overflow-hidden rounded-xl border bg-card">
  {/* A wide strip reads as a thin line; the cover keeps a calm 4:1 shape and never grows taller than a banner should. */}
  <OrganizationCover src={coverSrc} className={centered ? "aspect-auto h-24 sm:aspect-auto" : "max-h-56"} />
  {corner && <div className="absolute top-4 right-4 z-10 flex flex-wrap justify-end gap-2">{corner}</div>}
  <div className={cn("relative flex flex-wrap items-start gap-4 p-5",centered && "flex-col items-center pt-0 text-center")}>
   <span aria-hidden="true" className={cn("-mt-10 grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-strong bg-card text-2xl font-semibold shadow-sm sm:size-20 sm:text-3xl",centered && "-mt-16 size-16 sm:size-16 sm:text-2xl")}><EntityMark name={name} src={logoSrc} /></span>
   <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Heading className={cn("break-words text-xl font-semibold",preview && "text-base")}>{name.trim() || t("form.preview.namePlaceholder")}</Heading>{badge}</div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">{description?.trim() || t("cardNoDescription")}</p></div>
   {centered && <EntityStatusPill className="border border-success/25 bg-success/10 text-success" dotClassName="bg-success" label={t("statusValues.ACTIVE")}/>}
  </div>
 </div>;
}
