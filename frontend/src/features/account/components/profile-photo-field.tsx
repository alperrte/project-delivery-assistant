"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleNotch, UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import type { AuthenticatedUser } from "@/features/auth/api";
import { errorKey } from "@/lib/api/error-message";
import { accountApi, PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_TYPES, profilePhotoUrl } from "../api";

/**
 * Change or remove your own profile photo. A chosen file is only previewed here; nothing is uploaded until you
 * confirm, and a failed upload leaves the current photo in place. The client checks only save a round trip: the
 * server decides by the file's real content, size and dimensions.
 */
export function ProfilePhotoField({ user }: { user: AuthenticatedUser }) {
  const t = useTranslations("preferences.profile.photo");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The object URL is derived from the chosen file and released when the file changes or the field unmounts.
  const previewUrl = useMemo(() => (candidate ? URL.createObjectURL(candidate) : null), [candidate]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  const upload = useMutation({
    mutationFn: (file: File) => accountApi.uploadPhoto(file),
    onSuccess: async () => {
      setCandidate(null);
      setError(null);
      await refresh();
      toast.success(t("uploaded"));
    },
    onError: (err) => setError(te(errorKey(err))),
  });
  const remove = useMutation({
    mutationFn: () => accountApi.deletePhoto(),
    onSuccess: async () => {
      await refresh();
      toast.success(t("removed"));
    },
    onError: (err) => toast.error(te(errorKey(err))),
  });

  function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!PROFILE_PHOTO_TYPES.includes(file.type)) return setError(t("invalidType"));
    if (file.size > PROFILE_PHOTO_MAX_BYTES) return setError(t("tooLarge"));
    setError(null);
    setCandidate(file);
  }

  const hasPhoto = user.profilePhotoVersion != null;
  const busy = upload.isPending || remove.isPending;
  const currentSrc = hasPhoto ? profilePhotoUrl(user.id, user.profilePhotoVersion!) : null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar name={user.nickname} src={previewUrl ?? currentSrc} className="size-16 text-lg ring-0" />
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-muted-foreground">{candidate ? t("previewTitle") : t("photoLabel")}</p>
          {candidate ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" disabled={busy} aria-busy={upload.isPending} onClick={() => upload.mutate(candidate)}>
                {upload.isPending ? (
                  <CircleNotch size={14} className="animate-spin" data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <UploadSimple size={14} data-icon="inline-start" aria-hidden="true" />
                )}
                {upload.isPending ? t("uploading") : t("save")}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setCandidate(null); setError(null); }}>
                {t("cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
                <UploadSimple size={14} data-icon="inline-start" aria-hidden="true" />
                {hasPhoto ? t("change") : t("choose")}
              </Button>
              {hasPhoto && (
                <ConfirmDialog
                  trigger={<Button type="button" variant="ghost" size="sm" disabled={busy}>{t("remove")}</Button>}
                  title={t("removeConfirmTitle")}
                  description={t("removeConfirmDescription")}
                  confirmLabel={t("remove")}
                  cancelLabel={t("cancel")}
                  destructive
                  onConfirm={() => remove.mutateAsync()}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={PROFILE_PHOTO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={t("photoLabel")}
        data-testid="profile-photo-input"
        onChange={(event) => choose(event.target.files?.[0])}
      />
    </div>
  );
}
