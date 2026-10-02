"use client";

import { useTranslations } from "next-intl";
import { CheckSquare, FlagBanner, TreeStructure } from "@phosphor-icons/react";
import { useLabels } from "@/features/labels/hooks";
import { useSprints } from "@/features/sprints/hooks";
import { toDeadlineIso } from "../deadline";
import { useProjectMembers, useProjectTeams } from "../hooks";
import type { LabelRef, PersonRef, TaskPriority, TaskRef, TaskStatus } from "../types";
import { AssigneeAvatars, DeadlineChip, LabelList, PointsBadge, PoolMark, PriorityBadge, StatusBadge } from "./task-badges";

type TaskPreviewProps = {
  projectId: string;
  projectName: string;
  /** `null` while creating: the key is only assigned by the server. */
  taskKey: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description: string;
  estimatePoints: number | null;
  deadlineDate: string;
  deadlineTime: string;
  labelIds: string[];
  assigneeIds: string[];
  inPool: boolean;
  poolTeamId: string;
  parent: TaskRef | null;
  checklistCount: number;
  sprintId: string;
  /** People already known from the task being edited, so a removed member still shows a name. */
  known: PersonRef[];
};

/** The card exactly as the list and the pool will show it, rebuilt from the form values on every keystroke. */
export function TaskPreview(props: TaskPreviewProps) {
  const t = useTranslations("tasks.form.preview");
  const labels = useLabels(props.projectId);
  const members = useProjectMembers(props.projectId);
  const teams = useProjectTeams(props.projectId);
  const sprints = useSprints(props.projectId);

  const chosenLabels: LabelRef[] = props.labelIds.flatMap((id) => {
    const label = labels.data?.find((item) => item.id === id);
    return label ? [{ id: label.id, name: label.name, color: label.color }] : [];
  });
  const people: PersonRef[] = props.assigneeIds.map((userId) => {
    const nickname = members.data?.find((member) => member.userId === userId)?.nickname ?? props.known.find((person) => person.userId === userId)?.nickname ?? null;
    return { userId, nickname };
  });
  const team = props.poolTeamId ? teams.data?.find((item) => item.id === props.poolTeamId) : undefined;
  const sprint = props.sprintId ? sprints.data?.find((item) => item.id === props.sprintId) : undefined;
  const deadlineAt = props.deadlineDate ? toDeadlineIso(props.deadlineDate, props.deadlineTime) : null;
  const title = props.title.trim();
  const description = props.description.trim();

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label={t("title")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{props.taskKey ?? t("keyPending")}</span>
        <StatusBadge status={props.status} />
        <PriorityBadge priority={props.priority} />
        <span className="min-w-0 truncate text-xs text-muted-foreground">{props.projectName}</span>
      </div>

      {props.parent && (
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <TreeStructure size={13} aria-hidden="true" className="shrink-0" />
          <span className="font-mono tabular-nums">{props.parent.key}</span>
          <span className="truncate">{props.parent.title}</span>
        </p>
      )}

      <div className="min-w-0 space-y-1">
        <h3 className={title ? "text-sm font-semibold leading-5 break-words text-foreground" : "text-sm leading-5 text-muted-foreground"}>{title || t("titleEmpty")}</h3>
        {description && <p className="line-clamp-3 text-sm leading-5 break-words text-muted-foreground">{description}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {props.inPool && <PoolMark task={{ pool: { open: true, claimed: false, teamId: team?.id ?? null, teamName: team?.name ?? null } }} />}
        <LabelList labels={chosenLabels} max={3} />
        <PointsBadge points={props.estimatePoints} />
        <DeadlineChip task={{ deadlineAt, status: props.status }} />
        {props.checklistCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <CheckSquare size={13} aria-hidden="true" />
            <span>{t("checklist", { count: props.checklistCount })}</span>
          </span>
        )}
        {sprint && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <FlagBanner size={13} aria-hidden="true" />
            <span className="truncate">{sprint.name}</span>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        {props.inPool ? (
          <span className="text-xs text-muted-foreground">{t("poolNote")}</span>
        ) : (
          <AssigneeAvatars people={people} max={4} />
        )}
      </div>
    </article>
  );
}
