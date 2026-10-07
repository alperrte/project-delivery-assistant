"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EntityCover } from "@/components/common/entity-cover";
import { Button } from "@/components/ui/button";
import { errorKey } from "@/lib/api/error-message";
import { projectBannerUrl, projectsApi } from "../api";
import type { Project } from "../types";

export const BANNER_MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/**
 * Upload, replace and remove the project's cover image. The current cover is previewed above the controls in the
 * proportions the card uses, with the quiet dotted surface when there is none. Client checks only save a round trip;
 * the server re-validates.
 */
export function BannerField({ project }: { project: Project }) {
  const t = useTranslations("projects.settings.banner");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["projects"] });
  const upload = useMutation({
    mutationFn: (file: File) => projectsApi.uploadBanner(project.id, file),
    onSuccess: async () => {
      await refresh();
      toast.success(t("uploaded"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });
  const remove = useMutation({
    mutationFn: () => projectsApi.deleteBanner(project.id),
    onSuccess: async () => {
      await refresh();
      toast.success(t("removed"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  function accept(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) return setError(t("invalidType"));
    if (file.size > BANNER_MAX_BYTES) return setError(t("tooLarge"));
    setError(null);
    upload.mutate(file);
  }

  const hasBanner = project.bannerVersion != null;
  const bannerSrc = project.bannerVersion != null ? projectBannerUrl(project.id, project.bannerVersion) : null;
  return (
    <div className="space-y-3">
      <div data-testid="project-settings-banner" className="overflow-hidden rounded-lg border">
        <EntityCover key={bannerSrc ?? "none"} src={bannerSrc} />
      </div>
      <p className="text-sm text-foreground">{hasBanner ? t("statusSet") : t("statusNone")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
          <UploadSimple size={14} data-icon="inline-start" aria-hidden="true" />
          {hasBanner ? t("change") : t("choose")}
        </Button>
        {hasBanner && (
          <ConfirmDialog
            trigger={<Button type="button" variant="ghost" size="sm" disabled={remove.isPending}>{t("remove")}</Button>}
            title={t("removeConfirmTitle")}
            description={t("removeConfirmDescription")}
            confirmLabel={t("remove")}
            cancelLabel={t("cancel")}
            destructive
            onConfirm={() => remove.mutateAsync()}
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={t("label")}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
