"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretDown, Check, MagnifyingGlass, PencilSimple, Funnel } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ProjectMark } from "@/features/projects/components/project-mark";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { PROJECT_ROLES, type ProjectRole } from "@/features/projects/types";
import { errorKey } from "@/lib/api/error-message";
import { ApiError } from "@/lib/api/client";
import { invalidateTeamDeletion } from "../cache";
import { cn } from "@/lib/utils";
import { squadsApi } from "../api";
import { projectLogoSrc, teamsKey, useProjectContext } from "../hooks";
import { relativeTime } from "../relative-time";
import type { TeamMember } from "../types";
import { AddTeamMemberDialog } from "./add-team-member-dialog";
import { DeleteTeamButton } from "./delete-team-button";
import { TeamMembersTable } from "./team-members-table";
import { PageTitle } from "@/components/common/page-title";
import { BreadcrumbLabel } from "@/components/layout/breadcrumb-labels";

const PAGE_SIZE = 20;
const SORTS = ["joined_desc", "joined_asc", "name"] as const;
type Sort = (typeof SORTS)[number];

const isSort = (value: string | null): value is Sort => SORTS.some((sort) => sort === value);
const isRole = (value: string): value is ProjectRole => PROJECT_ROLES.some((role) => role === value);

/** `?page=` is one based in the URL; anything unusable falls back to the first page. */
function pageFromParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed - 1 : 0;
}

const displayName = (member: TeamMember) => member.nickname ?? member.email ?? member.userId;

export function TeamDetailPage({ slug, teamId }: { slug: string; teamId: string }) {
  const t = useTranslations("squads.detail");
  const ta = useTranslations("squads.addMember");
  const tr = useTranslations("roles");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: user, isError: sessionError } = useSession();
  const { project, member: currentMember, projectId, isManager } = useProjectContext(slug);
  const [editMode, setEditMode] = useState(false);

  const q = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(q);
  const roleParam = searchParams.get("role");
  const roles = useMemo(() => (roleParam ?? "").split(",").filter(isRole), [roleParam]);
  const sortParam = searchParams.get("sort");
  const sort: Sort = isSort(sortParam) ? sortParam : "joined_desc";
  const requestedPage = pageFromParam(searchParams.get("page"));

  const ready = !!projectId && !!currentMember.data;
  const team = useQuery({
    queryKey: [...teamsKey(projectId), teamId],
    queryFn: () => squadsApi.detail(projectId, teamId),
    refetchInterval: 30_000, refetchIntervalInBackground: false, refetchOnWindowFocus: "always",
    enabled: ready,
  });
  const roster = useQuery({
    queryKey: [...teamsKey(projectId), teamId, "members", "all"],
    queryFn: () => squadsApi.allMembers(projectId, teamId),
    enabled: ready && !!team.data,
  });
  const allTeams = useQuery({
    queryKey: [...teamsKey(projectId), "all"],
    queryFn: () => squadsApi.listAll(projectId),
    enabled: ready,
  });

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // The URL is only written once the user pauses typing, so every keystroke does not add a history entry.
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = window.setTimeout(() => update({ q: search.trim() || null, page: null }), 250);
    return () => window.clearTimeout(timer);
  }, [search, q, update]);

  useEffect(() => {
    if (!editMode) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // A dialog closes on Esc by itself; edit mode should stay put in that case.
      if (document.querySelector('[role="dialog"]')) return;
      setEditMode(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editMode]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);
    const matches = (roster.data ?? []).filter((member) => {
      if (roles.length > 0 && !roles.some((role) => member.roles.includes(role))) return false;
      if (!needle) return true;
      return displayName(member).toLocaleLowerCase(locale).includes(needle) || (member.email ?? "").toLocaleLowerCase(locale).includes(needle);
    });
    return matches.sort((a, b) => {
      if (sort === "name") return displayName(a).localeCompare(displayName(b), locale);
      const diff = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      return sort === "joined_asc" ? diff : -diff;
    });
  }, [roster.data, roles, search, sort, locale]);

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages - 1);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const filtersActive = roles.length > 0 || q !== "";

  function toggleRole(role: ProjectRole, checked: boolean) {
    const next = checked ? [...roles, role] : roles.filter((item) => item !== role);
    update({ role: next.length > 0 ? next.join(",") : null, page: null });
  }

  function clearFilters() {
    setSearch("");
    update({ q: null, role: null, page: null });
  }

  function onRemoved(userId: string, fromProject: boolean) {
    if (fromProject && userId === user?.id) {
      router.replace("/projects");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["projects", "by-slug", slug] });
  }

  const backHref = `/projects/${slug}?section=teams`;
  const redirected = useRef<string | null>(null);
  useEffect(() => {
    if (team.error instanceof ApiError && team.error.status === 404 && ready && redirected.current !== teamId) {
      redirected.current = teamId;
      void invalidateTeamDeletion(queryClient, projectId);
      router.replace(backHref);
    }
  }, [team.error, ready, teamId, projectId, queryClient, router, backHref]);


  if (project.isPending || (!sessionError && !user) || (!!project.data && currentMember.isPending) || (ready && team.isPending)) {
    return (
      <div className="space-y-5" aria-hidden="true">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const failure = project.error ?? currentMember.error ?? team.error;
  if (failure || !project.data || !team.data) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          {t("backToTeams")}
        </Link>
        <div className="workspace-panel space-y-3 p-6">
          <p role="alert" className="text-sm text-destructive">{te(errorKey(failure))}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (project.isError) void project.refetch();
              if (currentMember.isError) void currentMember.refetch();
              if (team.isError) void team.refetch();
            }}
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  const teamData = team.data;
  const projectData = project.data;
  const parent = teamData.parentTeamId ? allTeams.data?.find((item) => item.id === teamData.parentTeamId) : undefined;
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const total = roster.data?.length ?? teamData.memberCount;

  return (
    <div className="min-w-0 space-y-6">
      <BreadcrumbLabel kind="team" label={teamData.name} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/25 bg-primary/10 font-heading text-lg font-semibold text-primary"
          >
            <ProjectMark key={projectLogoSrc(projectData) ?? "none"} name={projectData.name} src={projectLogoSrc(projectData)} />
          </span>
          <div className="min-w-0 space-y-1.5">
            <PageTitle className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{teamData.name}</PageTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{teamData.description || t("noDescription")}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t("meta.members", { count: total })}</span>
              {parent && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("meta.parent")}{" "}
                    <Link href={`/projects/${slug}/teams/${parent.id}`} className="font-medium text-foreground hover:underline">{parent.name}</Link>
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                {t("meta.updated", { date: dateFormatter.format(new Date(teamData.updatedAt)), name: teamData.updatedBy.nickname })}
              </span>
              {teamData.lastJoined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("meta.lastJoined", {
                      name: teamData.lastJoined.nickname ?? "",
                      when: relativeTime(teamData.lastJoined.joinedAt, locale),
                    })}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            <AddTeamMemberDialog projectId={projectId} teamId={teamId} trigger={<Button>{ta("button")}</Button>} />
            <Button variant="outline" aria-pressed={editMode} onClick={() => setEditMode((current) => !current)}>
              {editMode ? <Check data-icon="inline-start" size={16} aria-hidden="true" /> : <PencilSimple data-icon="inline-start" size={16} aria-hidden="true" />}
              {editMode ? t("editMode.done") : t("editTeam")}
            </Button>
            <DeleteTeamButton projectId={projectId} teamId={teamId} teamName={teamData.name} onDeleted={() => router.replace(backHref)} />
          </div>
        )}
      </header>

      {isManager && editMode && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-strong bg-muted/50 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{t("editMode.title")}</span> · {t("editMode.hint")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/projects/${slug}/teams/${teamId}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("editMode.editInfo")}
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <MagnifyingGlass size={16} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="pl-8"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" aria-label={t("roleFilter")}>
                <Funnel data-icon="inline-start" size={16} aria-hidden="true" />
                {t("roleFilter")}
                {roles.length > 0 && <Badge variant="secondary">{roles.length}</Badge>}
                <CaretDown data-icon="inline-end" size={14} aria-hidden="true" />
              </Button>
            }
          />
          <DropdownMenuContent className="min-w-48">
            {PROJECT_ROLES.map((role) => (
              <DropdownMenuCheckboxItem key={role} checked={roles.includes(role)} onCheckedChange={(checked) => toggleRole(role, checked === true)}>
                {tr(role)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={sort} onValueChange={(next) => next && update({ sort: next === "joined_desc" ? null : next, page: null })}>
          <SelectTrigger className="w-48" aria-label={t("sort.label")}>
            <SelectValue>{(value: Sort) => t(`sort.${value}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((option) => (
              <SelectItem key={option} value={option}>{t(`sort.${option}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersActive && (
          <Button variant="ghost" onClick={clearFilters}>{t("clearFilters")}</Button>
        )}
      </div>

      {roster.isLoading && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-14 w-full rounded-lg" />)}
        </div>
      )}
      {roster.isError && (
        <div className="workspace-panel space-y-3 p-6">
          <p role="alert" className="text-sm text-destructive">{te(errorKey(roster.error))}</p>
          <Button variant="outline" size="sm" onClick={() => void roster.refetch()}>{t("retry")}</Button>
        </div>
      )}

      {roster.data && roster.data.length === 0 && (
        <EmptyState
          title={t("emptyTitle")}
          description={isManager ? t("emptyDescription") : t("emptyViewerDescription")}
          action={isManager ? <AddTeamMemberDialog projectId={projectId} teamId={teamId} trigger={<Button>{ta("button")}</Button>} /> : undefined}
        />
      )}

      {roster.data && roster.data.length > 0 && filtered.length === 0 && (
        <EmptyState
          title={t("noMatchesTitle")}
          description={t("noMatchesDescription")}
          action={<Button variant="outline" onClick={clearFilters}>{t("clearFilters")}</Button>}
        />
      )}

      {visible.length > 0 && (
        <>
          <TeamMembersTable
            members={visible}
            team={teamData}
            project={{ id: projectId, slug, createdBy: projectData.createdBy }}
            currentUserId={user?.id}
            editMode={isManager && editMode}
            onRemoved={onRemoved}
          />
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalElements={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={(next) => update({ page: next > 0 ? String(next + 1) : null })}
          />
        </>
      )}
    </div>
  );
}
