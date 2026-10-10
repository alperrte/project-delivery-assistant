"use client";

import { useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, Eye, Lock } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-labels";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/hooks/use-session";
import { PageFailure } from "@/features/errors/page-failure";
import type { UserRef } from "@/features/projects/types";
import { errorKey } from "@/lib/api/error-message";
import { squadsApi } from "../api";
import { projectLogoSrc, teamsKey, useProjectContext } from "../hooks";
import { teamFormSchema, TEAM_DESCRIPTION_MAX, TEAM_NAME_MAX, type TeamFormValues } from "../schemas";
import type { Team } from "../types";
import { TeamCard } from "./team-card";

const ROOT = "__root";

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h2 id={id} className="font-heading text-base font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** The team itself plus everything below it: none of these may become its parent. */
function descendantIds(teams: Team[], rootId: string): Set<string> {
  const found = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const team of teams) {
      if (team.parentTeamId && found.has(team.parentTeamId) && !found.has(team.id)) {
        found.add(team.id);
        grew = true;
      }
    }
  }
  return found;
}

/** Create (`teamId` omitted) and edit share one full-page form with a live card preview. */
export function TeamFormPage({ slug, teamId }: { slug: string; teamId?: string }) {
  const t = useTranslations("squads.form");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useSession();
  const ids = useId();
  const editing = teamId !== undefined;

  const { project, isManager, member } = useProjectContext(slug);
  const projectData = project.data;
  const projectId = projectData?.id ?? "";

  const teams = useQuery({
    queryKey: [...teamsKey(projectId), "all"],
    queryFn: () => squadsApi.listAll(projectId),
    enabled: !!projectId,
  });
  const team = teams.data?.find((item) => item.id === teamId);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { name: "", description: "", parentTeamId: "", includeCreator: true },
    values: team
      ? { name: team.name, description: team.description ?? "", parentTeamId: team.parentTeamId ?? "", includeCreator: true }
      : undefined,
  });
  const values = useWatch({ control });

  const backHref = editing ? `/projects/${slug}/teams/${teamId}` : `/projects/${slug}?section=teams`;
  const firstTeam = !editing && (teams.data?.length ?? 0) === 0;

  const created = useRef(false);
  const mutation = useMutation({
    mutationFn: async (form: TeamFormValues) => {
      const description = form.description?.trim() ?? "";
      const parentTeamId = form.parentTeamId || null;
      if (!teamId) {
        return squadsApi.create(projectId, {
          name: form.name.trim(),
          description: description || undefined,
          parentTeamId: parentTeamId ?? undefined,
          includeCreator: firstTeam || form.includeCreator,
        });
      }
      let saved = await squadsApi.update(projectId, teamId, { name: form.name.trim(), description });
      if (parentTeamId !== (team?.parentTeamId ?? null)) saved = await squadsApi.move(projectId, teamId, parentTeamId);
      return saved;
    },
    onSuccess: async (saved) => {
      created.current = true;
      await queryClient.invalidateQueries({ queryKey: teamsKey(projectId) });
      toast.success(t(editing ? "saved" : "created"));
      router.push(`/projects/${slug}/teams/${saved.id}`);
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const leaving = isDirty && !mutation.isPending && !mutation.isSuccess;
  useEffect(() => {
    if (!leaving) return;
    // `created` flips synchronously, before React has re-rendered, so a navigation right after saving never warns.
    const warn = (event: BeforeUnloadEvent) => {
      if (!created.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [leaving]);

  const author: UserRef = { userId: user?.id ?? "me", nickname: user?.nickname ?? t("preview.you") };
  const includeCreator = firstTeam || (values.includeCreator ?? true);
  const name = (values.name ?? "").trim();
  const parentId = values.parentTeamId || null;

  const previewTeam = useMemo<Team>(() => {
    const now = new Date().toISOString();
    const base = editing && team ? team : undefined;
    return {
      id: base?.id ?? "preview",
      projectId,
      name,
      description: values.description?.trim() || null,
      parentTeamId: parentId,
      memberCount: base ? base.memberCount : includeCreator ? 1 : 0,
      createdBy: base?.createdBy ?? author.userId,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
      updatedBy: author,
      // The session carries no project roles, so the live preview shows the creator without a role line.
      memberPreview: base ? base.memberPreview : includeCreator ? [{ ...author, roles: [] }] : [],
      lastJoined: base ? base.lastJoined : includeCreator ? { userId: author.userId, nickname: author.nickname, joinedAt: now } : null,
    };
    // `author` is derived from the session; keying on its fields keeps the memo stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, team, projectId, name, values.description, parentId, includeCreator, author.userId, author.nickname]);

  const blocked = descendantIds(teams.data ?? [], teamId ?? "");
  const parentOptions = (teams.data ?? []).filter((item) => !blocked.has(item.id));
  const parentName = parentId ? teams.data?.find((item) => item.id === parentId)?.name : null;

  // The member and team queries stay disabled (and so "pending") while the project is missing, e.g. refused with 403.
  if (project.isPending || (!!projectData && member.isPending) || (!!projectId && teams.isPending)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  const failure = project.error ?? member.error ?? teams.error;
  if (failure) return <PageFailure error={failure} onRetry={() => { void (project.error ? project.refetch() : member.error ? member.refetch() : teams.refetch()); }} />;
  if (!projectData) return null;
  if (!isManager || (editing && !team)) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">{te(isManager ? "notFound" : "forbidden")}</p>
        <Link href={`/projects/${slug}?section=teams`} className={buttonVariants({ variant: "outline" })}>
          {t("back")}
        </Link>
      </div>
    );
  }

  const nameLength = values.name?.length ?? 0;
  const descriptionLength = values.description?.length ?? 0;

  return (
    <div>
      {editing && team && <BreadcrumbLabel kind="team" label={team.name} />}
      <PageHeader title={t(editing ? "editTitle" : "title")} description={t(editing ? "editDescription" : "description")} />

      <form onSubmit={handleSubmit((form) => mutation.mutate(form))} noValidate>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-8 lg:col-span-7">
            <Section id={`${ids}-identity`} title={t("sections.identity.title")} description={t("sections.identity.description")}>
              <div className="space-y-1.5">
                <Label htmlFor="team-name">{t("name.label")}</Label>
                <Input
                  id="team-name"
                  autoComplete="off"
                  maxLength={TEAM_NAME_MAX}
                  placeholder={t("name.placeholder")}
                  aria-invalid={!!errors.name}
                  aria-describedby={`${ids}-name-note`}
                  {...register("name")}
                />
                {errors.name ? (
                  <p id={`${ids}-name-note`} role="alert" className="text-sm text-destructive">
                    {tv(errors.name.message!, { max: TEAM_NAME_MAX })}
                  </p>
                ) : (
                  <p id={`${ids}-name-note`} className="text-right text-xs text-muted-foreground">
                    {t("counter", { count: nameLength, max: TEAM_NAME_MAX })}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="team-description">{t("descriptionField.label")}</Label>
                  <span className="text-xs text-muted-foreground">{t("optional")}</span>
                </div>
                <Textarea
                  id="team-description"
                  rows={3}
                  maxLength={TEAM_DESCRIPTION_MAX}
                  placeholder={t("descriptionField.placeholder")}
                  aria-invalid={!!errors.description}
                  aria-describedby={`${ids}-description-note`}
                  {...register("description")}
                />
                {errors.description ? (
                  <p id={`${ids}-description-note`} role="alert" className="text-sm text-destructive">
                    {tv(errors.description.message!, { max: TEAM_DESCRIPTION_MAX })}
                  </p>
                ) : (
                  <p id={`${ids}-description-note`} className="text-right text-xs text-muted-foreground">
                    {t("counter", { count: descriptionLength, max: TEAM_DESCRIPTION_MAX })}
                  </p>
                )}
              </div>
            </Section>

            <Section id={`${ids}-placement`} title={t("sections.placement.title")} description={t("sections.placement.description")}>
              <div className="space-y-1.5">
                <Label>{t("parent.label")}</Label>
                <Controller
                  control={control}
                  name="parentTeamId"
                  render={({ field }) => (
                    <Select
                      value={field.value || ROOT}
                      onValueChange={(next) => setValue("parentTeamId", next === ROOT ? "" : (next ?? ""), { shouldDirty: true })}
                    >
                      <SelectTrigger className="w-full" aria-label={t("parent.label")}>
                        <SelectValue>
                          {(value: string) => (value === ROOT ? t("parent.none") : (teams.data?.find((item) => item.id === value)?.name ?? t("parent.none")))}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ROOT}>{t("parent.none")}</SelectItem>
                        {parentOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-sm text-muted-foreground">{t("parent.hint")}</p>
              </div>
            </Section>

            {!editing && (
              <Section id={`${ids}-membership`} title={t("sections.membership.title")} description={t("sections.membership.description")}>
                <Controller
                  control={control}
                  name="includeCreator"
                  render={({ field }) => (
                    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
                      <Checkbox
                        id="team-include-creator"
                        checked={firstTeam || field.value}
                        disabled={firstTeam}
                        onCheckedChange={(next) => field.onChange(next === true)}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="team-include-creator" className="leading-5">
                          {t("includeCreator.label")}
                        </Label>
                        <p className="text-sm leading-6 text-muted-foreground">{t("includeCreator.hint")}</p>
                        {firstTeam && (
                          <p className="flex items-center gap-1.5 text-sm text-foreground">
                            <Lock size={14} aria-hidden="true" />
                            {t("includeCreator.locked")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                />
              </Section>
            )}
          </div>

          <aside id="team-preview" aria-label={t("preview.title")} className="scroll-mt-24 lg:col-span-5">
            <div className="space-y-3 lg:sticky lg:top-24">
              <div className="space-y-0.5">
                <h2 className="font-heading text-base font-semibold text-foreground">{t("preview.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("preview.caption")}</p>
              </div>
              <div className="mx-auto max-w-sm lg:max-w-none">
                <TeamCard
                  team={previewTeam}
                  project={projectData}
                  parentName={parentName}
                  preview={{ logoSrc: projectLogoSrc(projectData), updatedLabel: t("preview.now"), joinedLabel: t("preview.joinedNow") }}
                />
              </div>
            </div>
          </aside>
        </div>

        <div data-sticky-actions className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-10 sm:-mb-8 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-8 sm:px-8">
          <div className="flex items-center justify-between gap-2">
            <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
              {t("cancel")}
            </Link>
            <div className="flex items-center gap-2">
              <a href="#team-preview" className={buttonVariants({ variant: "ghost", className: "lg:hidden" })}>
                <Eye size={16} data-icon="inline-start" aria-hidden="true" />
                <span className="sr-only min-[440px]:not-sr-only">{t("preview.show")}</span>
              </a>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
                {t(editing ? "save" : "submit")}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
