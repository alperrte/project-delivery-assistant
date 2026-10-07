"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { relativeTime, safeAvatarSrc, safeGitHubLink } from "../links";
import type { Commit } from "../types";

export function CommitRow({ commit, badge }: { commit: Commit; badge?: ReactNode }) {
  const locale = useLocale();
  const link = safeGitHubLink(commit.commitUrl);
  const message = <span className="block truncate">{commit.message}</span>;

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Avatar name={commit.author} src={safeAvatarSrc(commit.authorAvatarUrl)} className="mt-0.5 size-7 text-[10px]" />
      <div className="min-w-0 flex-1">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" title={commit.message} className="text-sm text-foreground hover:underline">
            {message}
          </a>
        ) : (
          <span title={commit.message} className="text-sm text-foreground">{message}</span>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{commit.author}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={commit.committedAt}>{relativeTime(commit.committedAt, locale)}</time>
          {badge}
        </p>
      </div>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground">
          {commit.shortSha}
        </a>
      ) : (
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{commit.shortSha}</span>
      )}
    </li>
  );
}

export function CommitListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
    </div>
  );
}

/** Where a commit stands relative to the default branch; shown on rows of other branches. */
export function MergeBadge({ merged }: { merged: boolean }) {
  const t = useTranslations("repository.branches");
  return merged
    ? <Badge variant="secondary" className="h-4 px-1.5 text-[11px]">{t("mergedBadge")}</Badge>
    : <Badge variant="outline" className="h-4 px-1.5 text-[11px] border-warning/50 text-warning">{t("unmergedBadge")}</Badge>;
}

/**
 * One place for every GitHub read failure of the repository page: 429 (our limit or GitHub's), 404 (branch gone
 * or repository removed) and anything else as "GitHub is unavailable".
 */
export function RepositoryReadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations("repository.errors");
  const status = error instanceof ApiError ? error.status : 0;
  const message = status === 429 ? t("rateLimited") : status === 404 ? t("notFound") : t("unavailable");

  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className={status === 429 ? "text-muted-foreground" : "text-destructive"}>{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>}
    </div>
  );
}
