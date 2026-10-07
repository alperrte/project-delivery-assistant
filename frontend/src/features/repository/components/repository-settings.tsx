"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GithubLogo, LinkSimple, CircleNotch, ArrowSquareOut, BellRinging } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { PageHeader } from "@/components/common/page-header";
import { PageContainer } from "@/components/common/page-container";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { repositoryApi, repositoryKeys } from "../api";
import { connectRepositorySchema, type ConnectRepositoryValues } from "../schemas";
import { safeGitHubLink } from "../links";
import { RepositoryBranches } from "./repository-branches";
import { RepositoryOverview } from "./repository-overview";

type RepositoryView = "overview" | "branches";

export function RepositorySettings({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const t = useTranslations("repository");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [connecting, setConnecting] = useState(false);

  const view: RepositoryView = searchParams.get("view") === "branches" ? "branches" : "overview";
  const branchParam = searchParams.get("branch") || null;

  const { data: connection, isLoading, error } = useQuery({
    queryKey: repositoryKeys.root(projectId),
    queryFn: () => repositoryApi.detail(projectId),
    retry: false,
  });

  const notConnected = error instanceof ApiError && error.status === 404;
  const realError = error && !notConnected;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: repositoryKeys.root(projectId) });

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConnectRepositoryValues>({ resolver: zodResolver(connectRepositorySchema), mode: "onBlur" });

  const connect = useMutation({
    mutationFn: (values: ConnectRepositoryValues) => repositoryApi.connect(projectId, values.repositoryUrl),
    onSuccess: () => {
      invalidate();
      toast.success(t("connected"));
      setConnecting(false);
      reset();
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const disconnect = useMutation({
    mutationFn: () => repositoryApi.disconnect(projectId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: [...repositoryKeys.root(projectId), "commits"] });
      queryClient.removeQueries({ queryKey: repositoryKeys.branches(projectId) });
      invalidate();
      toast.success(t("disconnected"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const repositoryLink = connection ? safeGitHubLink(connection.repositoryUrl) : null;

  return (
    <PageContainer width="wide">
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />

        {realError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

        {notConnected && !connecting && isManager && (
          <EmptyState
            title={t("noneTitle")}
            description={t("noneDescription")}
            className="flex min-h-72 flex-col items-center justify-center text-center [&_p]:mx-auto"
            action={<Button onClick={() => setConnecting(true)}><LinkSimple data-icon="inline-start" size={16} />{t("connect")}</Button>}
          />
        )}

        {notConnected && !isManager && (
          <EmptyState title={t("noneTitle")} description={t("noneDescription")} className="flex min-h-72 flex-col items-center justify-center text-center [&_p]:mx-auto" />
        )}

        {notConnected && connecting && (
          <form
            onSubmit={handleSubmit((values) => connect.mutate(values))}
            noValidate
            className="max-w-xl space-y-5 rounded-2xl border bg-card p-6 shadow-sm"
          >
            <div className="space-y-1.5">
              <Label htmlFor="repository-url">{t("urlLabel")}</Label>
              <Input
                id="repository-url"
                type="url"
                autoComplete="off"
                placeholder="https://github.com/owner/repo"
                aria-invalid={!!errors.repositoryUrl}
                {...register("repositoryUrl")}
              />
              <p className="text-xs text-muted-foreground">{t("publicOnly")}</p>
              {errors.repositoryUrl && (
                <p className="text-sm text-destructive">{tv(errors.repositoryUrl.message!)}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setConnecting(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting || connect.isPending}>
                {connect.isPending && <CircleNotch size={16} className="animate-spin" />}
                {t("connect")}
              </Button>
            </div>
          </form>
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
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <BellRinging size={14} aria-hidden="true" className="mt-px shrink-0" />
                    {t("notifyNote", { branch: connection.defaultBranch })}
                  </p>
                </div>
              </div>
              {isManager && (
                <ConfirmDialog
                  trigger={<Button variant="destructive">{t("disconnect")}</Button>}
                  title={t("disconnectConfirmTitle")}
                  confirmLabel={t("disconnect")}
                  cancelLabel={t("cancel")}
                  destructive
                  onConfirm={() => disconnect.mutateAsync()}
                />
              )}
            </div>

            <TabsList aria-label={t("views.label")}>
              <TabsTrigger value="overview" className="px-3">{t("views.overview")}</TabsTrigger>
              <TabsTrigger value="branches" className="px-3">{t("views.branches")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <RepositoryOverview projectId={projectId} connection={connection} onOpenBranches={() => navigate({ view: "branches" })} />
            </TabsContent>
            <TabsContent value="branches">
              <RepositoryBranches
                projectId={projectId}
                connection={connection}
                branchParam={branchParam}
                onSelectBranch={(branch) => navigate({ view: "branches", branch })}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </PageContainer>
  );
}
