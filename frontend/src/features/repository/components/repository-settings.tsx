"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { GithubLogo, ArrowSquareOut, BellRinging, BellSlash, GearSix } from "@phosphor-icons/react";
import Link, { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { PageHeader } from "@/components/common/page-header";
import { PageContainer } from "@/components/common/page-container";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { repositoryApi, repositoryKeys } from "../api";
import { safeGitHubLink } from "../links";
import { RepositoryBranches } from "./repository-branches";
import { RepositoryOverview } from "./repository-overview";

type RepositoryView = "overview" | "branches";

export function RepositorySettings({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const t = useTranslations("repository");
  const te = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: connection, isLoading, error } = useQuery({
    queryKey: repositoryKeys.root(projectId),
    queryFn: () => repositoryApi.detail(projectId),
    retry: false,
  });

  const notConnected = error instanceof ApiError && error.status === 404;
  const realError = error && !notConnected;

  // Branch exploration belongs to the advanced mode; a shared `view=branches` link on a basic project falls back to the overview.
  const advanced = connection?.trackingMode === "ADVANCED";
  const view: RepositoryView = advanced && searchParams.get("view") === "branches" ? "branches" : "overview";
  const branchParam = searchParams.get("branch") || null;

  /** The view and the branch live in the URL so a link to a branch can be shared and survives a reload. */
  function navigate(next: { view: RepositoryView; branch?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "repository");
    params.delete("view");
    params.delete("branch");
    if (next.view === "branches") {
      params.set("view", "branches");
      if (next.branch) params.set("branch", next.branch);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const repositoryLink = connection ? safeGitHubLink(connection.repositoryUrl) : null;

  return (
    <PageContainer width="wide">
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />

        {realError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

        {notConnected && (
          <EmptyState
            title={t("noneTitle")}
            description={isManager ? t("noneDescriptionManager") : t("noneDescription")}
            className="flex min-h-72 flex-col items-center justify-center text-center [&_p]:mx-auto"
            action={isManager ? <Link href={`${pathname}?section=settings`} className={buttonVariants()}><GearSix data-icon="inline-start" size={16} aria-hidden="true" />{t("goToSettings")}</Link> : undefined}
          />
        )}

        {connection && (
          <Tabs value={view} onValueChange={(next) => navigate({ view: next === "branches" ? "branches" : "overview" })} className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex min-w-0 items-start gap-3">
                <GithubLogo size={24} aria-hidden="true" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  {repositoryLink ? (
                    <a
                      href={repositoryLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-foreground hover:underline"
                    >
                      <span className="truncate">{connection.repositoryOwner}/{connection.repositoryName}</span>
                      <ArrowSquareOut size={14} aria-hidden="true" className="shrink-0" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-foreground">{connection.repositoryOwner}/{connection.repositoryName}</span>
                  )}
                  <p className="text-sm text-muted-foreground">{t("defaultBranch", { branch: connection.defaultBranch })}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t(`mode.${connection.trackingMode}`)}</Badge>
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      {connection.notifyOnCommits
                        ? <BellRinging size={14} aria-hidden="true" className="mt-px shrink-0" />
                        : <BellSlash size={14} aria-hidden="true" className="mt-px shrink-0" />}
                      {connection.notifyOnCommits ? t("notifyNote", { branch: connection.defaultBranch }) : t("notifyOff")}
                    </p>
                  </div>
                </div>
              </div>
              {isManager && (
                <Link href={`${pathname}?section=settings`} className={buttonVariants({ variant: "outline" })}>
                  <GearSix data-icon="inline-start" size={16} aria-hidden="true" />
                  {t("manageSettings")}
                </Link>
              )}
            </div>

            {advanced && (
              <TabsList aria-label={t("views.label")}>
                <TabsTrigger value="overview" className="px-3">{t("views.overview")}</TabsTrigger>
                <TabsTrigger value="branches" className="px-3">{t("views.branches")}</TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="overview">
              <RepositoryOverview projectId={projectId} connection={connection} onOpenBranches={advanced ? () => navigate({ view: "branches" }) : undefined} />
            </TabsContent>
            {advanced && (
              <TabsContent value="branches">
                <RepositoryBranches
                  projectId={projectId}
                  connection={connection}
                  branchParam={branchParam}
                  onSelectBranch={(branch) => navigate({ view: "branches", branch })}
                />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </PageContainer>
  );
}
