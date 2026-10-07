"use client";

import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { sessionQueryKey, useSession } from "@/features/auth/hooks/use-session";
import { cn } from "@/lib/utils";
import { squadsApi } from "../api";
import { invalidateTeamDeletion } from "../cache";

export function DeleteTeamButton({ projectId, teamId, teamName, className, onDeleted }: {
  projectId: string; teamId: string; teamName: string; className?: string; onDeleted?: () => void;
}) {
  const t = useTranslations("squads.delete");
  const te = useTranslations("errors");
  const client = useQueryClient();
  const { data: user } = useSession();
  const current = () => !!user?.id && user.id === client.getQueryData<{ id: string }>(sessionQueryKey)?.id;
  function message(error: unknown) {
    if (error instanceof ApiError && error.code === "TEAM_ARCHIVE_WOULD_ORPHAN") {
      const names = error.body?.members;
      if (Array.isArray(names)) return t("orphan", { names: names.filter(n => typeof n === "string").join(", ") });
    }
    if (error instanceof ApiError && error.code === "TEAM_HAS_CHILDREN") return t("children");
    return te(errorKey(error));
  }
  return <ConfirmDialog
    trigger={<Button variant="outline" size="icon" className={cn("relative z-10 min-h-11 min-w-11", className)} aria-label={t("label", { name: teamName })} title={t("button")}><Trash size={16} aria-hidden="true" /></Button>}
    title={t("title", { name: teamName })}
    description={t("description", { name: teamName })}
    confirmLabel={t("button")} cancelLabel={t("cancel")} destructive formatError={message}
    onConfirm={async () => {
      try {
        await squadsApi.delete(projectId, teamId);
        if (!current()) return;
        await invalidateTeamDeletion(client, projectId);
        toast.success(t("done")); onDeleted?.();
      } catch (error) {
        if (!current()) return;
        // After-commit delivery failure can coexist with a successful deletion; reconcile from actual server state.
        if (error instanceof ApiError && (error.status >= 500 || error.status === 404)) {
          try { await squadsApi.detail(projectId, teamId); }
          catch (recheck) {
            if (recheck instanceof ApiError && recheck.status === 404 && current()) {
              await invalidateTeamDeletion(client, projectId); toast.info(t("noLongerAvailable")); onDeleted?.(); return;
            }
          }
        }
        throw error;
      }
    }}
  />;
}
