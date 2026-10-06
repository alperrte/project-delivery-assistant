"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/features/auth/hooks/use-session";
import { PageFailure } from "@/features/errors/page-failure";
import { projectsApi } from "@/features/projects/api";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { PageSkeleton } from "./project-gate";
import { TaskDetailBody } from "./detail/task-detail-page";

export type MyTaskSelection = { projectId: string; taskId: string; comments?: boolean };

function Content({ selection }: { selection: MyTaskSelection }) {
  const { data: user } = useSession();
  const project = useQuery({ queryKey: ["projects", "detail", selection.projectId], queryFn: () => projectsApi.detail(selection.projectId) });
  const member = useCurrentMember(project.data?.id ?? "");
  const failure = project.error ?? member.error;
  if (failure) return <PageFailure error={failure} onRetry={() => { void (project.error ? project.refetch() : member.refetch()); }} />;
  if (!project.data || member.isPending || !user) return <PageSkeleton />;
  return <TaskDetailBody embedded focusComments={selection.comments} taskId={selection.taskId} project={project.data} slug={project.data.slug} projectId={project.data.id} isManager={member.isManager} userId={user.id} />;
}

export function MyTaskDialog({ selection, onClose }: { selection: MyTaskSelection | null; onClose: () => void }) {
  const t = useTranslations("tasks.my.cards");
  return <Dialog open={!!selection} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent showCloseButton={false} className="sm:max-w-5xl">
      <DialogTitle className="sr-only">{t("detailTitle")}</DialogTitle>
      <DialogDescription className="sr-only">{t("detailDescription")}</DialogDescription>
      <DialogClose render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label={t("close")} />}><X aria-hidden="true" /></DialogClose>
      {selection && <Content key={`${selection.projectId}:${selection.taskId}`} selection={selection} />}
    </DialogContent>
  </Dialog>;
}
