"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { errorKey } from "@/lib/api/error-message";
import { projectsApi, projectLogoSource } from "../api";
import { LOGO_ACCEPTED_TYPES, logoValidationError } from "../logo-validation";
import type { Project } from "../types";
import { ProjectMark } from "./project-mark";

/** Media is saved independently of the settings form; refetch never resets its unsaved text fields. */
export function ProjectLogoField({ project }: { project: Project }) {
  const t = useTranslations("projects.settings.logo");
  const tv = useTranslations("projects.newPage.logo");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["projects"] });
  const onError = (err: unknown) => {
    const message = te(errorKey(err));
    setError(message);
    toast.error(message);
  };
  const upload = useMutation({
    mutationFn: (file: File) => projectsApi.uploadLogo(project.id, file),
    onSuccess: async () => { await refresh(); toast.success(t("uploaded")); },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => projectsApi.deleteLogo(project.id),
    onSuccess: async () => { await refresh(); toast.success(t("removed")); },
    onError,
  });
  const busy = upload.isPending || remove.isPending;
  const src = projectLogoSource(project);

  function accept(file: File | undefined) {
    if (!file || busy) return;
    const invalid = logoValidationError(file);
    if (invalid) return setError(tv(invalid));
    setError(null);
    upload.mutate(file);
  }

  return (
    <div data-testid="project-logo-field" aria-busy={busy} className="space-y-3">
      <div className="flex items-center gap-4">
        <span aria-hidden="true" data-testid="project-settings-mark"
          className="grid size-16 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 font-heading text-2xl font-semibold text-primary">
          <ProjectMark name={project.name} src={src} />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-foreground">{src ? t("statusSet") : t("statusNone")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <UploadSimple size={14} data-icon="inline-start" aria-hidden="true" />
              {src ? t("change") : t("choose")}
            </Button>
            {src && <ConfirmDialog
              trigger={<Button type="button" variant="ghost" size="sm" disabled={busy}>{t("remove")}</Button>}
              title={t("removeConfirmTitle")} description={t("removeConfirmDescription")}
              confirmLabel={t("remove")} cancelLabel={t("cancel")} destructive
              onConfirm={async () => {
                setError(null);
                // The mutation reports the error; keep the server's logo and allow another attempt.
                await remove.mutateAsync().catch(() => undefined);
              }}
            />}
          </div>
        </div>
      </div>
      <p id={hintId} className="text-sm text-muted-foreground">{t("hint")}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <input ref={inputRef} type="file" accept={LOGO_ACCEPTED_TYPES.join(",")} className="sr-only" tabIndex={-1}
        aria-label={t("label")} aria-describedby={hintId} disabled={busy}
        onChange={(event) => { accept(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
  );
}
