"use client";

import { useSyncExternalStore } from "react";
import Link from "@/i18n/navigation";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ListBullets, Plus, TreeStructure } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { EntityGrid } from "@/components/common/entity-card";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Project } from "@/features/projects/types";
import { membersApi } from "@/features/projects/members-api";
import { errorKey } from "@/lib/api/error-message";
import { squadsApi, TEAM_PAGE_SIZE } from "../api";
import { teamsKey } from "../hooks";
import { TeamCard } from "./team-card";
import { TeamChart } from "./team-chart";

type View = "list" | "chart";
const VIEW_STORAGE_KEY = "pda.teams.view";

const isView = (value: string | null): value is View => value === "list" || value === "chart";

const viewListeners = new Set<() => void>();

function readStoredView(): View | null {
  try {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return isView(saved) ? saved : null;
  } catch {
    // Storage can be blocked; the list view is a fine default.
    return null;
  }
}

function subscribeToView(listener: () => void) {
  viewListeners.add(listener);
  return () => { viewListeners.delete(listener); };
}

function storeView(next: View) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  } catch {
    // Not remembering the choice is harmless.
  }
  viewListeners.forEach((listener) => listener());
}

/** `?page=` is one based in the URL; anything unusable falls back to the first page. */
function pageFromParam(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed - 1 : 0;
}

function TeamCardSkeleton() {
  return (
    <div className="w-full rounded-xl border bg-card p-4" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-lg" />
        <Skeleton className="h-6 w-1/2" />
      </div>
      <div className="space-y-4 pt-5">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}

export function TeamsPage({ project, isManager }: { project: Project; isManager: boolean }) {
  const t = useTranslations("squads");
  const te = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The saved choice is only read on the client, so the server snapshot is null and hydration agrees.
  const remembered = useSyncExternalStore(subscribeToView, readStoredView, () => null);

  const requested = searchParams.get("view");
  const view: View = isView(requested) ? requested : (remembered ?? "list");

  const teams = useQuery({
    queryKey: [...teamsKey(project.id), "all"],
    queryFn: () => squadsApi.listAll(project.id),
  });
  const members = useQuery({
    queryKey: ["projects", project.id, "members", "count"],
    queryFn: () => membersApi.list(project.id, 0, 1),
    enabled: view === "chart",
  });

  function href(next: { view?: View; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.view) params.set("view", next.view);
    if (next.page !== undefined) {
      if (next.page > 0) params.set("page", String(next.page + 1));
      else params.delete("page");
    }
    return `${pathname}?${params.toString()}`;
  }

  function changeView(next: View) {
    storeView(next);
    router.replace(href({ view: next, page: 0 }), { scroll: false });
  }

  function goToPage(next: number) {
    router.push(href({ page: next }), { scroll: false });
    window.scrollTo({ top: 0 });
  }

  const all = teams.data ?? [];
  const totalPages = Math.max(Math.ceil(all.length / TEAM_PAGE_SIZE), 1);
  const page = Math.min(pageFromParam(searchParams.get("page")), totalPages - 1);
  const visible = all.slice(page * TEAM_PAGE_SIZE, (page + 1) * TEAM_PAGE_SIZE);
  const parentNames = new Map(all.map((team) => [team.id, team.name]));

  const createLink = isManager && (
    <Link href={`/projects/${project.slug}/teams/new`} className={buttonVariants()}>
      <Plus data-icon="inline-start" size={16} aria-hidden="true" />
      {t("create")}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {all.length > 0 && (
              <Tabs value={view} onValueChange={(next) => isView(next as string) && changeView(next as View)}>
                <TabsList aria-label={t("view.label")} className="group-data-horizontal/tabs:h-9">
                  <TabsTrigger value="list" className="px-2.5">
                    <ListBullets size={16} aria-hidden="true" />
                    {t("view.list")}
                  </TabsTrigger>
                  <TabsTrigger value="chart" className="px-2.5">
                    <TreeStructure size={16} aria-hidden="true" />
                    {t("view.chart")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            {createLink}
          </div>
        }
      />

      {teams.isLoading && (
        <EntityGrid>
          {[0, 1, 2].map((key) => (
            <li key={key} className="flex">
              <TeamCardSkeleton />
            </li>
          ))}
        </EntityGrid>
      )}
      {teams.isError && <p role="alert" className="text-sm text-destructive">{te(errorKey(teams.error))}</p>}

      {teams.data && all.length === 0 && (
        <EmptyState
          title={t("emptyTitle")}
          description={isManager ? t("emptyDescription") : t("emptyViewerDescription")}
          action={isManager ? createLink : undefined}
        />
      )}

      {teams.data && all.length > 0 && view === "list" && (
        <>
          <EntityGrid>
            {visible.map((team) => (
              <li key={team.id} className="flex">
                <TeamCard
                  team={team}
                  project={project}
                  parentName={team.parentTeamId ? parentNames.get(team.parentTeamId) : null}
                  canManage={isManager}
                />
              </li>
            ))}
          </EntityGrid>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalElements={all.length}
            pageSize={TEAM_PAGE_SIZE}
            onPageChange={goToPage}
          />
        </>
      )}

      {teams.data && all.length > 0 && view === "chart" && (
        <TeamChart project={project} teams={all} memberTotal={members.data?.totalElements ?? null} />
      )}
    </div>
  );
}
