"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowsClockwise, GitBranch, GitCommit } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { repositoryApi, repositoryKeys } from "../api";
import type { RepositoryConnection } from "../types";
import { CommitListSkeleton, CommitRow, RepositoryReadError } from "./commit-list";

const OVERVIEW_COMMITS = 10;

/** The latest commits of the default branch plus a way into the branch view. */
export function RepositoryOverview({
  projectId,
  connection,
  onOpenBranches,
}: {
  projectId: string;
  connection: RepositoryConnection;
  /** Only the advanced mode explores branches; without it the branch list is neither fetched nor offered. */
  onOpenBranches?: () => void;
}) {
  const t = useTranslations("repository");

  const commits = useQuery({
    queryKey: [...repositoryKeys.commits(projectId, null, null), OVERVIEW_COMMITS],
    queryFn: () => repositoryApi.commits(projectId, { limit: OVERVIEW_COMMITS }),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const branches = useQuery({
    queryKey: repositoryKeys.branches(projectId),
    queryFn: () => repositoryApi.branches(projectId),
    enabled: !!onOpenBranches,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card" aria-labelledby="repository-latest-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <h3 id="repository-latest-title" className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <GitCommit size={16} aria-hidden="true" />
            <span className="truncate">{t("overview.latestTitle", { branch: connection.defaultBranch })}</span>
          </h3>
          <Button variant="ghost" size="icon-sm" aria-label={t("commits.refresh")} onClick={() => void commits.refetch()} disabled={commits.isFetching}>
            <ArrowsClockwise size={14} className={commits.isFetching ? "animate-spin" : undefined} />
          </Button>
        </div>
        <div className="p-3">
          {commits.isLoading && <CommitListSkeleton />}
          {commits.isError && <RepositoryReadError error={commits.error} onRetry={() => void commits.refetch()} />}
          {commits.data && commits.data.length === 0 && <EmptyState title={t("commits.emptyTitle")} className="border-0 px-0 py-6 shadow-none" />}
          {commits.data && commits.data.length > 0 && (
            <ul className="divide-y">
              {commits.data.map((commit) => <CommitRow key={commit.sha} commit={commit} />)}
            </ul>
          )}
        </div>
      </section>

      {onOpenBranches && branches.data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <GitBranch size={16} aria-hidden="true" />
            {t(branches.data.truncated ? "overview.branchCountMore" : "overview.branchCount", { count: branches.data.branches.length })}
          </p>
          <Button variant="outline" size="sm" onClick={onOpenBranches}>{t("overview.exploreBranches")}</Button>
        </div>
      )}
    </div>
  );
}
