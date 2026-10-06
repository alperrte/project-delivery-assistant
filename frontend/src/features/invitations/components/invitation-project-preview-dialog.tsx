"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard, type ProjectCardData } from "@/features/projects/components/project-card";
import { invitationsApi } from "../api";
import { invitationKeys } from "../query-keys";
import { useSession } from "@/features/auth/hooks/use-session";

export function InvitationProjectPreviewDialog({ invitationId, onClose }: {
  invitationId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("invitations");
  const { data: user } = useSession();
  const preview = useQuery({
    queryKey: invitationKeys.preview(user?.id, invitationId),
    queryFn: ({ signal }) => invitationsApi.previewMine(invitationId!, signal),
    enabled: !!user?.id && invitationId !== null,
  });
  const project = preview.data;
  const card: ProjectCardData | null = project ? {
    id: project.projectId,
    slug: project.slug,
    name: project.name,
    tagline: project.tagline,
    description: project.description,
    projectGoal: project.projectGoal,
    status: project.status,
    projectType: project.projectType,
    techStack: project.techStack,
    updatedAt: project.updatedAt,
    updatedBy: null,
    logoVersion: project.logoVersion,
    team: { memberCount: project.memberCount, preview: [] },
  } : null;

  return (
    <Dialog open={invitationId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("minePreviewTitle")}</DialogTitle>
          <DialogDescription>{t("minePreviewDescription")}</DialogDescription>
        </DialogHeader>
        {preview.isPending && (
          <div aria-label={t("minePreviewLoading")} role="status" className="space-y-3">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}
        {preview.isError && (
          <div className="space-y-3 rounded-lg border p-4">
            <p role="alert" className="text-sm text-destructive">{t("minePreviewError")}</p>
            <Button variant="outline" size="sm" onClick={() => void preview.refetch()}>{t("retry")}</Button>
          </div>
        )}
        {!preview.isError && card && project && invitationId && (
          <ProjectCard
            project={card}
            invitationPreview={{
              logoSrc: project.logoVersion == null ? null
                : invitationsApi.previewLogoUrl(invitationId, project.logoVersion),
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
