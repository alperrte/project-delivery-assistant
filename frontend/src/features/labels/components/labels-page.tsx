"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { settle } from "@/features/tasks/components/detail/detail-section";
import { ProjectGate, type ProjectGateContext } from "@/features/tasks/components/project-gate";
import { LabelChip } from "@/features/tasks/components/task-badges";
import { useTaskMutation } from "@/features/tasks/hooks";
import { errorKey } from "@/lib/api/error-message";
import { labelsApi } from "../api";
import { useLabels } from "../hooks";
import type { Label } from "../types";
import { LabelDialog } from "./label-dialog";

function LabelRow({ projectId, label, isManager, onEdit }: { projectId: string; label: Label; isManager: boolean; onEdit: (label: Label) => void }) {
  const t = useTranslations("labels.row");
  const archive = useTaskMutation(projectId, () => labelsApi.archive(projectId, label.id), {
    onSuccess: () => toast.success(t("archived", { name: label.name })),
  });

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <LabelChip label={label} />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t("usage", { count: label.usageCount })}</span>
      {isManager && (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(label)} aria-label={t("edit", { name: label.name })}>
            <PencilSimple aria-hidden="true" />
          </Button>
          <ConfirmDialog
            destructive
            title={t("archiveTitle", { name: label.name })}
            description={t("archiveDescription", { count: label.usageCount })}
            confirmLabel={t("archive")}
            cancelLabel={t("cancel")}
            onConfirm={() => archive.mutateAsync(undefined).then(settle, settle)}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("archiveLabel", { name: label.name })}>
                <Trash aria-hidden="true" />
              </Button>
            }
          />
        </div>
      )}
    </li>
  );
}

function LabelsView({ projectId, isManager }: ProjectGateContext) {
  const t = useTranslations("labels");
  const te = useTranslations("errors");
  const labels = useLabels(projectId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);

  const list = [...(labels.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const createButton = isManager && (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden="true" />
      {t("create")}
    </Button>
  );

  return (
    <div>
      <PageHeader title={t("title")} description={isManager ? t("description") : t("memberDescription")} action={createButton || undefined} />

      {labels.isError && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{te(errorKey(labels.error))}</p>
          <Button variant="outline" size="sm" onClick={() => void labels.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {labels.isPending && (
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      )}

      {labels.data && list.length === 0 && (
        <EmptyState title={t("emptyTitle")} description={isManager ? t("emptyManagerDescription") : t("emptyMemberDescription")} action={createButton || undefined} />
      )}

      {labels.data && list.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {list.map((label) => (
            <LabelRow key={label.id} projectId={projectId} label={label} isManager={isManager} onEdit={setEditing} />
          ))}
        </ul>
      )}

      {isManager && (
        <>
          <LabelDialog projectId={projectId} open={creating} onOpenChange={setCreating} />
          <LabelDialog key={editing?.id} projectId={projectId} label={editing ?? undefined} open={!!editing} onOpenChange={(open) => !open && setEditing(null)} />
        </>
      )}
    </div>
  );
}

export function LabelsPage({ slug }: { slug: string }) {
  return <ProjectGate slug={slug}>{(context) => <LabelsView {...context} />}</ProjectGate>;
}
