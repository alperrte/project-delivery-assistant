"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link, { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleNotch, Eye, Buildings, ImageSquare, LinkSimple, FileText, Globe, Envelope, MapPin, Lightbulb } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormErrorSummary, focusFormSection, type FormErrorSection } from "@/components/common/form-error-summary";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StickyFormActions } from "@/components/common/sticky-form-actions";
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-labels";
import { ImagePicker } from "@/components/common/image-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/hooks/use-session";
import { PageFailure } from "@/features/errors/page-failure";
import { errorKey } from "@/lib/api/error-message";
import { LOGO_MAX_BYTES, COVER_MAX_BYTES } from "@/lib/media/image-validation";
import { usePickedImage } from "@/lib/media/use-picked-image";
import { organizationsApi, organizationImageSource } from "../api";
import { organizationKeys, invalidateOrganizationQueries } from "../queries";
import { organizationFormSchema, type OrganizationFormValues } from "../schemas";
import type { Organization } from "../types";
import { OrganizationCard, type OrganizationCardData } from "./organization-card";
import { OrganizationProfileHeader } from "./organization-profile-header";

function formValues(org?: Organization): OrganizationFormValues {
 return { name: org?.name ?? "", description: org?.description ?? "", website: org?.website ?? "", contactEmail: org?.contactEmail ?? "", location: org?.location ?? "", notes: org?.notes ?? "" };
}
function Section({ id, title, description, icon, violet = false, children }: { id: string; title: string; description: string; icon: ReactNode; violet?: boolean; children: ReactNode }) {
 return <section aria-labelledby={id} className="space-y-4 border-t pt-4 first:border-0 first:pt-0"><div className="flex items-start gap-4"><span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-lg ${violet ? "bg-label-violet/15 text-label-violet" : "bg-label-blue/15 text-label-blue"}`}>{icon}</span><div className="min-w-0"><h2 id={id} className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>{children}</section>;
}
function useMediaDraft(savedSrc: string | null) {
 const picked = usePickedImage(); const [removed, setRemoved] = useState(false); const [applied, setApplied] = useState(false);
 return { ...picked, removed, applied, markApplied() { setApplied(true); }, src: picked.url ?? (removed ? null : savedSrc),
  change(file: File | null) { const wasPicked = !!picked.file; picked.change(file); setRemoved(file || wasPicked ? false : !!savedSrc); setApplied(false); },
  settle() { picked.change(null); setRemoved(false); setApplied(false); },
 };
}

/** Load once before mounting the editor; query refetches cannot reset a user's unsaved values. */
export function OrganizationFormPage({ organizationId }: { organizationId?: string }) {
 const t = useTranslations("organizations.form"); const { data: user } = useSession();
 const existing = useQuery({ queryKey: organizationKeys.detail(organizationId ?? ""), queryFn: () => organizationsApi.detail(organizationId!), enabled: !!organizationId });
 if (organizationId && existing.isError) return <PageFailure error={existing.error} onRetry={() => { void existing.refetch(); }} />;
 if (organizationId && (!existing.data || !user)) return <Skeleton className="h-64 w-full" />;
 if (existing.data && (existing.data.status === "ARCHIVED" || user?.id !== existing.data.ownerUserId)) return <p role="alert">{t("notEditable")}</p>;
 return <OrganizationEditor key={organizationId ?? "create"} initial={existing.data} />;
}

function OrganizationEditor({ initial }: { initial?: Organization }) {
 const t = useTranslations("organizations"); const tf = useTranslations("organizations.form"); const tp = useTranslations("organizations.profile");
 const tv = useTranslations("validation"); const tfs = useTranslations("forms.summary"); const te = useTranslations("errors"); const router = useRouter(); const queryClient = useQueryClient();
 const editing = !!initial; const [saved, setSaved] = useState(initial);
 const [signature, setSignature] = useState(initial ? JSON.stringify(formValues(initial)) : null);
 const [failures, setFailures] = useState<string[]>([]);
 const submitted = useRef(false); const busy = useRef(false);
 const logo = useMediaDraft(saved ? organizationImageSource(saved, "logo") : null);
 const cover = useMediaDraft(saved ? organizationImageSource(saved, "cover") : null);
 const { register, handleSubmit, control, reset, formState: { errors, isDirty, submitCount } } = useForm<OrganizationFormValues>({ resolver: zodResolver(organizationFormSchema), shouldFocusError: false, defaultValues: formValues(initial) });
 const values = useWatch({ control });
 const dirty = isDirty || ((!logo.applied) && (!!logo.file || logo.removed)) || ((!cover.applied) && (!!cover.file || cover.removed));
 useEffect(() => {
  const warn = (event: BeforeUnloadEvent) => { if (dirty && !submitted.current) event.preventDefault(); };
  window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
 }, [dirty]);
 const mutation = useMutation({
  mutationFn: async (form: OrganizationFormValues) => {
   let org = saved;
   if (!org) org = await organizationsApi.create(form);
   else if (signature !== JSON.stringify(form)) org = await organizationsApi.update(org.id, form);
   // Persist the created ID before any upload or read can fail; retry must not POST a second organization.
   setSaved(org); setSignature(JSON.stringify(form)); reset(form);
   const failed: string[] = []; const completed: (() => void)[] = [];
   for (const [kind, media] of [["logo", logo], ["cover", cover]] as const) {
    if (media.applied) { completed.push(media.settle); continue; }
    if (!media.file && !media.removed) continue;
    try {
     if (media.file) await organizationsApi.upload(org.id, kind, media.file);
     else await organizationsApi.removeImage(org.id, kind);
     media.markApplied(); completed.push(media.settle);
    } catch { failed.push(kind); }
   }
   try { org = await organizationsApi.detail(org.id); completed.forEach(settle => settle()); }
   catch { failed.push("refresh"); }
   return { org, failed };
  },
  onSuccess: async ({ org, failed }) => {
   setSaved(org); setFailures(failed); await invalidateOrganizationQueries(queryClient);
   if (failed.length) { toast.warning(tp("partial")); return; }
   submitted.current = true; toast.success(editing ? tf("updated") : tf("created")); router.push(`/organizations/${org.id}`);
  },
  onError: (err) => toast.error(te(errorKey(err))),
 });
 const saving = mutation.isPending;
 const failedSections: [string, string, boolean][] = [
  ["general", tf("sections.general.title"), !!(errors.name || errors.description)],
  ["contact", tp("contactTitle"), !!(errors.website || errors.contactEmail || errors.location)],
  ["details", tp("detailsTitle"), !!errors.notes],
 ];
 const summarySections: FormErrorSection[] = failedSections.filter(([, , failed]) => failed).map(([key, label]) => ({ id: key, label, focus: () => focusFormSection(`org-${key}`) }));
 // react-hook-form bumps `submitCount` together with the final errors state, so `aria-invalid` is rendered when this runs and the
 // first failed section (page order) focuses its first invalid field. Valid submits have no failed sections; typing never changes it.
 useEffect(() => {
  summarySections[0]?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [submitCount]);
 const backHref = editing ? `/organizations/${initial!.id}` : "/organizations";
 const draft: OrganizationCardData = { id: saved?.id ?? "preview", name: values.name ?? "", description: values.description ?? null, status: saved?.status ?? "ACTIVE", updatedAt: saved?.updatedAt ?? "", website: values.website ?? null, location: values.location ?? null };
 const labels = (kind: "logo" | "cover") => ({ label: tp(kind), choose: tp(kind === "logo" ? "uploadLogo" : "uploadCover"), change: tp("change"), remove: tp("remove"), hint: tp(kind === "logo" ? "logoHint" : "coverHint"), invalidType: tp("invalidType"), tooLarge: tp("tooLarge"), empty: tp("empty"), detail: tp(kind === "logo" ? "logoFallbackHint" : "coverPlacementHint") });
 return <PageContainer width="wide">
  <Link href={backHref} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={16} aria-hidden="true" />{editing ? tf("backToOrganization") : t("backToOrganizations")}</Link>
  {initial && <BreadcrumbLabel kind="organization" label={initial.name} />}
  <PageHeader title={editing ? tf("editTitle") : tf("createTitle")} description={editing ? tf("editDescription") : tf("createDescription")} />
  {failures.length > 0 && saved && <section role="alert" className="mb-6 space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
   <p>{tp("partial")}</p><ul className="list-inside list-disc">{failures.map(kind => <li key={kind}>{tp(kind === "logo" ? "failedLogo" : kind === "cover" ? "failedCover" : "failedRefresh")}</li>)}</ul>
   <Button type="button" variant="outline" className="h-auto max-w-full whitespace-normal" onClick={() => { submitted.current = true; router.push(`/organizations/${saved.id}`); }}>{tp("continue")}</Button>
  </section>}
  <form noValidate aria-busy={saving} onSubmit={(event) => {
   if (busy.current) { event.preventDefault(); return; } busy.current = true;
   void handleSubmit(async (form) => { try { await mutation.mutateAsync(form); } catch { /* onError reports it. */ } })(event).finally(() => { busy.current = false; });
  }}>
   <div className="grid items-start gap-5 lg:grid-cols-12">
    <fieldset disabled={saving} className="min-w-0 space-y-4 rounded-xl border bg-surface-2/60 p-4 sm:p-5 lg:col-span-7">
     <Section icon={<Buildings size={22}/>} id="org-general" title={tf("sections.general.title")} description={tf("sections.general.description")}>
      <div className="space-y-1.5"><Label htmlFor="org-name">{tf("name")}<span aria-hidden="true" className="text-destructive"> *</span></Label><Input id="org-name" required autoFocus maxLength={160} placeholder={tf("namePlaceholder")} aria-invalid={!!errors.name} aria-describedby={errors.name ? "org-name-error" : undefined} {...register("name")} />{errors.name && <p id="org-name-error" role="alert" className="text-sm text-destructive">{tv(errors.name.message!)}</p>}</div>
      <div className="space-y-1.5"><Label htmlFor="org-description">{tf("description")}</Label><Textarea id="org-description" rows={4} maxLength={2000} placeholder={tf("descriptionPlaceholder")} aria-invalid={!!errors.description} aria-describedby="org-description-hint" {...register("description")} />
       <div className="flex justify-end gap-3"><p id="org-description-hint" className="sr-only">{tf("descriptionHint")}</p><span className="shrink-0 text-xs text-muted-foreground tabular-nums">{values.description?.length ?? 0}/2000</span></div>
       {errors.description && <p role="alert" className="text-sm text-destructive">{tv(errors.description.message!)}</p>}
      </div>
     </Section>
     <Section violet icon={<ImageSquare size={22}/>} id="org-identity" title={tp("identityTitle")} description={tp("identityDescription")}>
      <div className="grid gap-4 md:grid-cols-2"><ImagePicker tile name={values.name} src={logo.src} onChange={logo.change} maximum={LOGO_MAX_BYTES} labels={labels("logo")} disabled={saving} removeControl={!logo.file && saved?.logoVersion && !logo.removed ? <ConfirmDialog trigger={<Button type="button" variant="ghost" size="sm" disabled={saving}>{tp("remove")}</Button>} title={tp("removeTitle")} description={tp("removeDescription")} confirmLabel={tp("remove")} cancelLabel={tf("cancel")} destructive onConfirm={async () => logo.change(null)} /> : undefined} />
      <ImagePicker tile cover src={cover.src} onChange={cover.change} maximum={COVER_MAX_BYTES} labels={labels("cover")} disabled={saving} removeControl={!cover.file && saved?.coverVersion && !cover.removed ? <ConfirmDialog trigger={<Button type="button" variant="ghost" size="sm" disabled={saving}>{tp("remove")}</Button>} title={tp("removeTitle")} description={tp("removeDescription")} confirmLabel={tp("remove")} cancelLabel={tf("cancel")} destructive onConfirm={async () => cover.change(null)} /> : undefined} /></div>
     </Section>
     <Section icon={<LinkSimple size={22}/>} id="org-contact" title={tp("contactTitle")} description={tp("contactDescription")}>
      <div className="grid gap-4 sm:grid-cols-2">
       {(["website", "contactEmail", "location"] as const).map((key) => <div key={key} className={key === "website" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
        <div className="flex items-center justify-between gap-2"><Label htmlFor={`org-${key}`}>{tp(key)}</Label><span className="text-xs text-muted-foreground">{tp("optional")}</span></div><div className="relative"><span aria-hidden="true" className="pointer-events-none absolute top-2.5 left-3 text-muted-foreground">{key === "website" ? <Globe size={16}/> : key === "contactEmail" ? <Envelope size={16}/> : <MapPin size={16}/>}</span><Input className="pl-9" id={`org-${key}`} type={key === "contactEmail" ? "email" : "text"} inputMode={key === "website" ? "url" : key === "contactEmail" ? "email" : "text"} maxLength={key === "website" ? 2048 : key === "contactEmail" ? 254 : 200} placeholder={tp(key === "contactEmail" ? "emailPlaceholder" : `${key}Placeholder`)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `org-${key}-error` : undefined} {...register(key)} /></div>
        {errors[key] && <p id={`org-${key}-error`} role="alert" className="text-sm text-destructive">{tv(errors[key]!.message!)}</p>}
       </div>)}
      </div>
     </Section>
     <Section icon={<FileText size={22}/>} id="org-details" title={tp("detailsTitle")} description={tp("detailsDescription")}>
      <div className="space-y-1.5"><div className="flex items-center justify-between gap-2"><Label htmlFor="org-notes">{tp("notes")}</Label><span className="text-xs text-muted-foreground">{tp("optional")}</span></div><Textarea id="org-notes" rows={3} maxLength={1000} placeholder={tp("notesPlaceholder")} aria-invalid={!!errors.notes} aria-describedby={`org-notes-hint${errors.notes ? " org-notes-error" : ""}`} {...register("notes")}/><div className="flex justify-end"><span id="org-notes-hint" className="text-xs text-muted-foreground tabular-nums">{values.notes?.length ?? 0}/1000</span></div>{errors.notes && <p id="org-notes-error" role="alert" className="text-sm text-destructive">{tv(errors.notes.message!)}</p>}</div>
     </Section>
    </fieldset>
    <aside id="organization-preview" aria-label={tf("preview.title")} className="min-w-0 scroll-mt-24 lg:col-span-5"><div className="space-y-4 lg:sticky lg:top-24">
     <div className="space-y-5 rounded-xl border bg-surface-2/60 p-4">
      <div className="flex items-start gap-4"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-label-blue/15 text-label-blue"><Eye size={22}/></span><div><h2 className="text-base font-semibold">{tf("preview.title")}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{tf("preview.caption")}</p></div></div>
      <OrganizationProfileHeader preview centered name={draft.name} description={draft.description} logoSrc={logo.src} coverSrc={cover.src}/>
      <section aria-label={tp("cardPreview")}><h2 className="mb-2 text-sm font-medium">{tp("cardPreview")}</h2><OrganizationCard organization={draft} preview={{ updatedLabel: tf("preview.now"), logoSrc: logo.src, coverSrc: cover.src }} /></section>
      <section aria-label={tp("profilePreview")}><h2 className="mb-2 text-sm font-medium">{tp("profilePreview")}</h2><OrganizationProfileHeader preview name={draft.name} description={draft.description} logoSrc={logo.src} coverSrc={cover.src} /></section>
     </div>
     <section className="flex items-start gap-4 rounded-xl border border-label-blue/15 bg-label-blue/5 p-4"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-label-amber/10 text-label-amber"><Lightbulb size={22}/></span><div><h2 className="text-sm font-semibold text-label-blue">{tp("helpTitle")}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{tp("helpDescription")}</p></div></section>
    </div></aside>
   </div>
   <FormErrorSummary key={submitCount} id="org-form-summary" title={editing ? tfs("organizationEditTitle") : tfs("organizationCreateTitle")} description={tfs("description")} sectionsLabel={tfs("sectionsLabel")} sections={summarySections} />
   <StickyFormActions className={summarySections.length > 0 ? "mt-4" : undefined}>
    <div className="flex items-center justify-between gap-2"><Link href={backHref} className={buttonVariants({ variant: "outline" })}>{tf("cancel")}</Link><div className="flex min-w-0 flex-1 items-center justify-end gap-2">
     <a href="#organization-preview" className={buttonVariants({ variant: "ghost", className: "lg:hidden" })}><Eye size={16} aria-hidden="true" /><span className="sr-only min-[440px]:not-sr-only">{tf("preview.show")}</span></a>
     <Button type="submit" aria-describedby={summarySections.length > 0 ? "org-form-summary" : undefined} className="h-auto min-h-9 min-w-0 whitespace-normal bg-label-blue px-5 py-1 text-white shadow-sm hover:bg-label-blue/90 dark:bg-label-blue/65 dark:hover:bg-label-blue/65 dark:saturate-150" disabled={saving}>{saving && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}{failures.length ? tp("retry") : editing ? tf("save") : tf("create")}</Button>
    </div></div>
   </StickyFormActions>
  </form>
 </PageContainer>;
}
