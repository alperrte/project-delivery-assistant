"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CircleNotch, GitBranch, GitCommit } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { repositoryApi, repositoryKeys } from "../api";
import { relativeTime, safeAvatarSrc } from "../links";
import type { Commit, RepositoryConnection } from "../types";
import { BranchPicker } from "./branch-picker";
import { CommitListSkeleton, CommitRow, MergeBadge, RepositoryReadError } from "./commit-list";

const PAGE_SIZE = 30;
// The API serves at most 10 pages of a branch.
const MAX_PAGES = 10;

type MergeFilter = "all" | "unmerged" | "merged";

/** Branch explorer: pick a branch, see who did what on it and which of its commits have not reached the default branch. */
export function RepositoryBranches({
  projectId,
  connection,
  branchParam,
  onSelectBranch,
}: {
  projectId: string;
  connection: RepositoryConnection;
  /** The `?branch=` URL value; null selects the default branch. */
  branchParam: string | null;
  onSelectBranch: (branch: string) => void;
}) {
  const t = useTranslations("repository.branches");

  const branches = useQuery({
    queryKey: repositoryKeys.branches(projectId),
    queryFn: () => repositoryApi.branches(projectId),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (branches.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]" role="status" aria-label={t("loading")}>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (branches.isError) return <RepositoryReadError error={branches.error} onRetry={() => void branches.refetch()} />;
  if (!branches.data) return null;

  const selected = branchParam ?? connection.defaultBranch;
  const known = branches.data.branches.some((branch) => branch.name === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <BranchPicker branches={branches.data.branches} selected={selected} truncated={branches.data.truncated} onSelect={onSelectBranch} />
      <div className="min-w-0">
        {known ? (
          <BranchDetail key={selected} projectId={projectId} branch={selected} defaultBranch={connection.defaultBranch} />
        ) : (
          <div role="alert" className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium text-foreground">{t("missingTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("missingDescription", { branch: selected })}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => onSelectBranch(connection.defaultBranch)}>
              {t("backToDefault", { branch: connection.defaultBranch })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type AuthorStat = { key: string; login: string | null; name: string; avatar: string | null; count: number; last: string };

function authorStats(commits: Commit[]): AuthorStat[] {
  const stats = new Map<string, AuthorStat>();
  for (const commit of commits) {
    const key = commit.authorLogin ?? `name:${commit.author}`;
    const stat = stats.get(key);
    if (stat) {
      stat.count += 1;
      if (Date.parse(commit.committedAt) > Date.parse(stat.last)) stat.last = commit.committedAt;
    } else {
      stats.set(key, { key, login: commit.authorLogin, name: commit.author, avatar: safeAvatarSrc(commit.authorAvatarUrl), count: 1, last: commit.committedAt });
    }
  }
  return [...stats.values()].sort((a, b) => b.count - a.count || Date.parse(b.last) - Date.parse(a.last));
}

function useBranchCommits(projectId: string, branch: string, author: string | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: repositoryKeys.commits(projectId, branch, author),
    queryFn: ({ pageParam }) =>
      repositoryApi.commits(projectId, { branch, author: author ?? undefined, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.length >= PAGE_SIZE && pages.length < MAX_PAGES ? pages.length + 1 : undefined),
    enabled,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

function BranchDetail({ projectId, branch, defaultBranch }: { projectId: string; branch: string; defaultBranch: string }) {
  const t = useTranslations("repository.branches");
  const locale = useLocale();
  const isDefault = branch === defaultBranch;
  const [author, setAuthor] = useState<string | null>(null);
  const [filter, setFilter] = useState<MergeFilter>("all");

  const compare = useQuery({
    queryKey: repositoryKeys.compare(projectId, branch),
    queryFn: () => repositoryApi.compare(projectId, branch),
    enabled: !isDefault,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  // The unfiltered list feeds the author strip and stays cached while an author filter is active.
  const everyone = useBranchCommits(projectId, branch, null, true);
  const byAuthor = useBranchCommits(projectId, branch, author, author !== null);
  const list = author ? byAuthor : everyone;

  const authors = useMemo(() => authorStats(everyone.data?.pages.flat() ?? []), [everyone.data]);
  const unmergedShas = useMemo(() => new Set(compare.data?.unmergedCommits.map((commit) => commit.sha) ?? []), [compare.data]);

  // Merged state is only trustworthy while the comparison is complete (GitHub cuts it at 100 commits).
  const mergeKnown = !isDefault && compare.isSuccess;
  const mergedKnown = mergeKnown && !compare.data.truncated;
  const activeFilter: MergeFilter = filter === "merged" && !mergedKnown ? "all" : filter;

  const commits = useMemo(() => {
    const all = list.data?.pages.flat() ?? [];
    if (!mergeKnown || activeFilter === "all") return all;
    return all.filter((commit) => (activeFilter === "unmerged") === unmergedShas.has(commit.sha));
  }, [list.data, mergeKnown, activeFilter, unmergedShas]);

  const options: MergeFilter[] = mergedKnown ? ["all", "unmerged", "merged"] : ["all", "unmerged"];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4" aria-label={t("statusLabel")}>
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
          <GitBranch size={16} aria-hidden="true" className="shrink-0" />
          <span className="truncate" title={branch}>{branch}</span>
        </h3>
        <div className="mt-2 text-sm text-muted-foreground">
          {isDefault && <p>{t("isDefault")}</p>}
          {!isDefault && compare.isLoading && <Skeleton className="h-5 w-56" />}
          {!isDefault && compare.isError && <RepositoryReadError error={compare.error} onRetry={() => void compare.refetch()} />}
          {!isDefault && compare.data && (
            <p data-testid="branch-status">
              {compare.data.aheadBy === 0 && compare.data.behindBy === 0
                ? t("upToDate", { base: defaultBranch })
                : t("aheadBehind", { ahead: compare.data.aheadBy, behind: compare.data.behindBy, base: defaultBranch })}
            </p>
          )}
          {!isDefault && compare.data?.truncated && <p className="mt-1 text-xs">{t("compareTruncated")}</p>}
        </div>
      </section>

      {authors.length > 0 && (
        <section className="rounded-xl border bg-card p-4" aria-labelledby="repository-authors-title">
          <h3 id="repository-authors-title" className="text-sm font-medium text-foreground">{t("authorsTitle")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("authorsHint", { count: everyone.data?.pages.flat().length ?? 0 })}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {authors.map((stat) => {
              const active = stat.login !== null && stat.login === author;
              const content = (
                <>
                  <Avatar name={stat.name} src={stat.avatar} className="size-6 text-[10px]" />
                  <span className="min-w-0 text-left">
                    <span className="block max-w-40 truncate text-sm font-medium text-foreground">{stat.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("authorMeta", { count: stat.count, time: relativeTime(stat.last, locale) })}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={stat.key}>
                  {stat.login ? (
                    <button
                      type="button"
                      aria-pressed={active}
                      title={t("filterByAuthor", { author: stat.name })}
                      onClick={() => setAuthor(active ? null : stat.login)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        active ? "border-primary bg-accent" : "hover:bg-muted",
                      )}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-card" aria-labelledby="repository-branch-commits-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <h3 id="repository-branch-commits-title" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <GitCommit size={16} aria-hidden="true" />
            {author ? t("commitsByAuthor", { author }) : t("commitsTitle")}
          </h3>
          {mergeKnown && (
            <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-1">
              {options.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={activeFilter === option ? "secondary" : "ghost"}
                  aria-pressed={activeFilter === option}
                  onClick={() => setFilter(option)}
                >
                  {t(`filter.${option}`)}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="p-3">
          {list.isLoading && <CommitListSkeleton />}
          {list.isError && <RepositoryReadError error={list.error} onRetry={() => void list.refetch()} />}
          {list.isSuccess && commits.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {author ? t("emptyAuthor") : activeFilter === "all" ? t("empty") : t("emptyFiltered")}
            </p>
          )}
          {commits.length > 0 && (
            <ul className="divide-y" data-testid="branch-commits">
              {commits.map((commit) => (
                <CommitRow
                  key={commit.sha}
                  commit={commit}
                  badge={mergeKnown && (unmergedShas.has(commit.sha) || mergedKnown) ? <MergeBadge merged={!unmergedShas.has(commit.sha)} /> : undefined}
                />
              ))}
            </ul>
          )}
          {list.hasNextPage && (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" size="sm" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                {list.isFetchingNextPage && <CircleNotch size={14} className="animate-spin" aria-hidden="true" />}
                {t("loadMore")}
              </Button>
            </div>
          )}
          {list.isSuccess && !list.hasNextPage && list.data.pages.length >= MAX_PAGES && (
            <p className="mt-3 text-center text-xs text-muted-foreground">{t("historyLimit", { count: PAGE_SIZE * MAX_PAGES })}</p>
          )}
        </div>
      </section>
    </div>
  );
}
