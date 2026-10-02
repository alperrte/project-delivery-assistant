"use client";

import { useTranslations } from "next-intl";
import { Archive } from "@phosphor-icons/react";
import { PageFailure } from "@/features/errors/page-failure";
import { ApiError } from "@/lib/api/client";
import { useTask } from "../../hooks";
import { taskPermissions, type TaskPermissions } from "../../permissions";
import type { Task } from "../../types";
import { PageSkeleton, ProjectGate, type ProjectGateContext } from "../project-gate";
import { ActivitySection } from "./activity-section";
import { AttachmentsSection } from "./attachments-section";
import { ChecklistSection } from "./checklist-section";
import { DetailSection, type DetailContext } from "./detail-section";
import { PropertiesPanel } from "./properties-panel";
import { RelationsSection } from "./relations-section";
import { SubtasksSection } from "./subtasks-section";
import { TaskHeader } from "./task-header";

/** An archived task is read only for everybody, including the manager. */
function permissionsFor(task: Task, userId: string, isManager: boolean): TaskPermissions {
  const perms = taskPermissions(task, userId, isManager);
  if (!task.archivedAt) return perms;
  return { ...perms, manage: false, work: false, canClaim: false, canRelease: false };
}

function Description({ task }: { task: Task }) {
  const t = useTranslations("tasks.detail");
  return (
    <DetailSection id="detail-description" title={t("description.title")}>
      {task.description?.trim() ? (
        <p className="text-sm leading-6 break-words whitespace-pre-wrap text-foreground">{task.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("description.empty")}</p>
      )}
    </DetailSection>
  );
}

function TaskDetailBody({ slug, project, projectId, isManager, userId, taskId }: ProjectGateContext & { taskId: string }) {
  const t = useTranslations("tasks.detail");
  const task = useTask(projectId, taskId);

  if (task.isPending) return <PageSkeleton />;
  if (task.isError || !task.data) {
    return <PageFailure error={task.error ?? new ApiError(404)} onRetry={() => { void task.refetch(); }} />;
  }

  const data = task.data;
  const ctx: DetailContext = { task: data, slug, projectId, userId, isManager, perms: permissionsFor(data, userId, isManager) };

  return (
    <article aria-label={`${data.taskKey} ${data.title}`}>
      <TaskHeader {...ctx} projectName={project.name} />

      {data.archivedAt && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Archive size={16} className="shrink-0" aria-hidden="true" />
          {t("archivedNotice")}
        </p>
      )}

      {/*
        Reading order on a phone is description, subtasks, checklist, properties, relations, attachments, activity.
        On a wide screen the properties sit in a right column spanning both rows, so the DOM order is the visual one.
      */}
      <div className="grid gap-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 space-y-8 lg:col-span-8 lg:col-start-1 lg:row-start-1">
          <Description task={data} />
          {!data.parent && <SubtasksSection {...ctx} />}
          <ChecklistSection {...ctx} />
        </div>

        <div className="min-w-0 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
          <PropertiesPanel {...ctx} />
        </div>

        <div className="min-w-0 space-y-8 lg:col-span-8 lg:col-start-1 lg:row-start-2">
          <RelationsSection {...ctx} />
          <AttachmentsSection {...ctx} />
          <ActivitySection {...ctx} />
        </div>
      </div>
    </article>
  );
}

export function TaskDetailPage({ slug, taskId }: { slug: string; taskId: string }) {
  return <ProjectGate slug={slug}>{(context) => <TaskDetailBody {...context} taskId={taskId} />}</ProjectGate>;
}
