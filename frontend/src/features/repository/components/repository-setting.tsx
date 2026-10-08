"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, CircleNotch, GithubLogo, LinkSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SettingsSection } from "@/components/common/settings-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { invalidateRepository, repositoryApi, repositoryKeys } from "../api";
import { safeGitHubLink } from "../links";
import { GITHUB_REPOSITORY_URL } from "../schemas";
import type { RepositoryConnection, RepositorySettings } from "../types";
import { DEFAULT_REPOSITORY_SETTINGS, RepositoryOptions } from "./repository-options";

/**
 * "GitHub deposu" block of the project settings: connect, change the tracking mode / notification switch, or
 * disconnect. It lives inside the settings `<form>`, so it never renders a form of its own and every button is
 * `type="button"`.
 */
export function RepositorySetting({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const t = useTranslations("repository.setting");
  const te = useTranslations("errors");

  const { data: connection, isLoading, error } = useQuery({
    queryKey: repositoryKeys.root(projectId),
    queryFn: () => repositoryApi.detail(projectId),
    retry: false,
  });
  const notConnected = error instanceof ApiError && error.status === 404;
  const realError = error && !notConnected;

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      {isLoading && <Skeleton className="h-24 w-full" />}
      {realError && <p className="text-sm text-destructive">{te(errorKey(error))}</p>}
      {notConnected && <ConnectRepository projectId={projectId} />}
      {connection && <ConnectedRepository key={`${connection.trackingMode}:${connection.notifyOnCommits}`} projectId={projectId} projectSlug={projectSlug} connection={connection} />}
    </SettingsSection>
  );
}

function ConnectRepository({ projectId }: { projectId: string }) {
  const t = useTranslations("repository.setting");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [settings, setSettings] = useState<RepositorySettings>(DEFAULT_REPOSITORY_SETTINGS);

  const connect = useMutation({
    mutationFn: (repositoryUrl: string) => repositoryApi.connect(projectId, { repositoryUrl, ...settings }),
    onSuccess: async () => {
      await invalidateRepository(queryClient, projectId);
      toast.success(t("connected"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  function submit() {
    const value = url.trim();
    const ok = GITHUB_REPOSITORY_URL.test(value);
    setInvalid(!ok);
    if (ok) connect.mutate(value);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">{t("notConnected")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="settings-repository-url">{t("urlLabel")}</Label>
        <Input
          id="settings-repository-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          maxLength={500}
          placeholder="https://github.com/owner/repo"
          value={url}
          aria-invalid={invalid}
          aria-describedby="settings-repository-url-note"
          className="h-10 bg-background px-3"
          onChange={(event) => {
            setUrl(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            // Enter must not submit the surrounding project settings form.
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        {invalid ? (
          <p id="settings-repository-url-note" role="alert" className="text-sm text-destructive">{tv("githubUrl")}</p>
        ) : (
          <p id="settings-repository-url-note" className="text-xs leading-5 text-muted-foreground">{t("publicOnly")}</p>
        )}
      </div>
      <RepositoryOptions value={settings} onChange={setSettings} disabled={connect.isPending} />
      <Button type="button" onClick={submit} disabled={connect.isPending}>
        {connect.isPending ? <CircleNotch size={16} className="animate-spin" aria-hidden="true" /> : <LinkSimple size={16} data-icon="inline-start" aria-hidden="true" />}
        {t("connect")}
      </Button>
    </div>
  );
}

function ConnectedRepository({ projectId, projectSlug, connection }: { projectId: string; projectSlug: string; connection: RepositoryConnection }) {
  const t = useTranslations("repository.setting");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<RepositorySettings>({
    trackingMode: connection.trackingMode,
    notifyOnCommits: connection.notifyOnCommits,
  });
  const changed = settings.trackingMode !== connection.trackingMode || settings.notifyOnCommits !== connection.notifyOnCommits;
  const link = safeGitHubLink(connection.repositoryUrl);

  const save = useMutation({
    mutationFn: () => repositoryApi.updateSettings(projectId, settings),
    onSuccess: async () => {
      await invalidateRepository(queryClient, projectId);
      toast.success(t("saved"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const disconnect = useMutation({
    mutationFn: () => repositoryApi.disconnect(projectId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: [...repositoryKeys.root(projectId), "commits"] });
      queryClient.removeQueries({ queryKey: repositoryKeys.branches(projectId) });
      await invalidateRepository(queryClient, projectId);
      toast.success(t("disconnected"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 items-start gap-3 rounded-lg border bg-card p-4">
        <GithubLogo size={22} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-foreground hover:underline">
              <span className="truncate">{connection.repositoryOwner}/{connection.repositoryName}</span>
              <ArrowSquareOut size={14} aria-hidden="true" className="shrink-0" />
            </a>
          ) : (
            <span className="text-sm font-medium text-foreground">{connection.repositoryOwner}/{connection.repositoryName}</span>
          )}
          <p className="text-sm text-muted-foreground">{t("defaultBranch", { branch: connection.defaultBranch })}</p>
        </div>
      </div>

      <RepositoryOptions value={settings} onChange={setSettings} disabled={save.isPending} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => save.mutate()} disabled={!changed || save.isPending}>
          {save.isPending && <CircleNotch size={16} className="animate-spin" aria-hidden="true" />}
          {t("save")}
        </Button>
        <Link href={`/projects/${projectSlug}?section=repository`} className={buttonVariants({ variant: "outline" })}>
          {t("openPage")}
        </Link>
        <ConfirmDialog
          trigger={<Button type="button" variant="destructive" className="ml-auto">{t("disconnect")}</Button>}
          title={t("disconnectConfirmTitle")}
          description={t("disconnectConfirmDescription")}
          confirmLabel={t("disconnect")}
          cancelLabel={t("cancel")}
          destructive
          onConfirm={() => disconnect.mutateAsync()}
        />
      </div>
    </div>
  );
}
