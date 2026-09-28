"use client";

import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowsClockwise, GitCommit } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { repositoryApi } from "../api";

const DIVISIONS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

function relativeTime(iso: string, locale: string): string {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, secondsInUnit] of DIVISIONS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return formatter.format(Math.round(seconds), "second");
}

export function CommitsWidget({ projectId }: { projectId: string }) {
  const t = useTranslations("repository.commits");
  const te = useTranslations("errors");
  const locale = useLocale();

  const { data: commits, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["projects", projectId, "repository", "commits"],
    queryFn: () => repositoryApi.commits(projectId, 10),
    retry: false,
  });

  const rateLimited = error instanceof ApiError && error.status === 429;
  const unavailable = error instanceof ApiError && !rateLimited;

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <GitCommit size={16} />
          {t("title")}
        </h3>
        <Button variant="ghost" size="icon-sm" aria-label={t("refresh")} onClick={() => refetch()} disabled={isFetching}>
          <ArrowsClockwise size={14} className={isFetching ? "animate-spin" : undefined} />
        </Button>
      </div>

      <div className="p-3">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {rateLimited && <p className="text-sm text-muted-foreground">{te("tooManyRequests")}</p>}
        {unavailable && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

        {commits && commits.length === 0 && <EmptyState title={t("emptyTitle")} />}

        {commits && commits.length > 0 && (
          <ul className="divide-y">
            {commits.map((commit) => (
              <li key={commit.shortSha} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <a
                    href={commit.commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-foreground hover:underline"
                  >
                    {commit.message}
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {commit.author} · {relativeTime(commit.committedAt, locale)}
                  </p>
                </div>
                <a
                  href={commit.commitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  {commit.shortSha}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
