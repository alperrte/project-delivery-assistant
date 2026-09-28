"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GithubLogo, LinkSimple, CircleNotch, ArrowSquareOut } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { repositoryApi } from "../api";
import { connectRepositorySchema, type ConnectRepositoryValues } from "../schemas";
import { CommitsWidget } from "./commits-widget";

export function RepositorySettings({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const t = useTranslations("repository");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const { data: connection, isLoading, error } = useQuery({
    queryKey: ["projects", projectId, "repository"],
    queryFn: () => repositoryApi.detail(projectId),
    retry: false,
  });

  const notConnected = error instanceof ApiError && error.status === 404;
  const realError = error && !notConnected;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects", projectId, "repository"] });

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
      invalidate();
      toast.success(t("disconnected"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      {realError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}

      {notConnected && !connecting && isManager && (
        <EmptyState
          title={t("noneTitle")}
          description={t("noneDescription")}
          action={<Button onClick={() => setConnecting(true)}><LinkSimple data-icon="inline-start" size={16} />{t("connect")}</Button>}
        />
      )}

      {notConnected && !isManager && (
        <EmptyState title={t("noneTitle")} description={t("noneDescription")} />
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <GithubLogo size={24} />
              <div>
                <a
                  href={connection.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                >
                  {connection.repositoryOwner}/{connection.repositoryName}
                  <ArrowSquareOut size={14} />
                </a>
                <p className="text-sm text-muted-foreground">{t("defaultBranch", { branch: connection.defaultBranch })}</p>
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

          <CommitsWidget projectId={projectId} />
        </div>
      )}
    </div>
  );
}
