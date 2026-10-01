"use client";

import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Archive } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { squadsApi } from "../api";
import { teamsKey } from "../hooks";

/** Names the server returns when archiving would leave people without any team. */
function orphanNames(err: unknown): string[] {
  if (!(err instanceof ApiError) || err.code !== "TEAM_ARCHIVE_WOULD_ORPHAN") return [];
  const members = err.body?.members;
  return Array.isArray(members) ? members.filter((name): name is string => typeof name === "string") : [];
}

export function ArchiveTeamButton({
  projectId,
  teamId,
  teamName,
  className,
  onArchived,
}: {
  projectId: string;
  teamId: string;
  teamName: string;
  className?: string;
  onArchived?: () => void;
}) {
  const t = useTranslations("squads.archive");
  const tq = useTranslations("squads");
  const te = useTranslations("errors");
  const queryClient = useQueryClient();

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="icon" className={cn("relative z-10", className)} aria-label={t("label", { name: teamName })} title={t("button")}>
          <Archive size={16} aria-hidden="true" />
        </Button>
      }
      title={t("title", { name: teamName })}
      description={t("description")}
      confirmLabel={t("button")}
      cancelLabel={tq("cancel")}
      destructive
      onConfirm={async () => {
        try {
          await squadsApi.archive(projectId, teamId);
          await queryClient.invalidateQueries({ queryKey: teamsKey(projectId) });
          toast.success(t("done"));
          onArchived?.();
        } catch (err) {
          const names = orphanNames(err);
          toast.error(names.length > 0 ? t("orphan", { names: names.join(", ") }) : te(errorKey(err)));
          throw err;
        }
      }}
    />
  );
}
