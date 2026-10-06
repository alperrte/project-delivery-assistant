"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleNotch, HandGrabbing, HandPalm, LockSimple, LockSimpleOpen, UsersThree } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSprints } from "@/features/sprints/hooks";
import { cn } from "@/lib/utils";
import { tasksApi } from "../../api";
import { deadlineState } from "../../deadline";
import { useTaskFormat } from "../../format";
import { useTaskMutation, useWatchers } from "../../hooks";
import { payloadFromTask, TASK_LABELS_MAX } from "../../schemas";
import { ESTIMATE_POINTS, TASK_PRIORITIES, type TaskPriority } from "../../types";
import { deadlineToneClass } from "../../workflow";
import { useClaimTask } from "../pool-card";
import { StatusMenu } from "../status-menu";
import { AssigneeAvatars, DeadlineChip, LabelList, PoolMark, PriorityIndicator } from "../task-badges";
import { LabelPicker } from "../task-form-fields";
import { AssigneesDialog } from "./assignees-dialog";
import { BlockDialog } from "./block-dialog";
import { PropertyRow, settle, type DetailContext } from "./detail-section";
import { LockedHint } from "./locked-hint";
import { TimeTracking } from "./time-tracking";

const NONE = "__none";
const WATCHERS_SHOWN = 8;

export function PropertiesPanel(ctx: DetailContext) {
  const { task, slug, projectId, userId, perms } = ctx;
  const t = useTranslations("tasks.detail.panel");
  const tc = useTranslations("tasks.common");
  const tm = useTranslations("taskModels");
  const format = useTaskFormat();
  const archived = !!task.archivedAt;
  const [blocking, setBlocking] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const advanced = task.creationMode === "ADVANCED";
  const advancedManage = ctx.advancedWritable && perms.manage && !archived;
  const sprints = useSprints(projectId, undefined, advanced);
  const watchers = useWatchers(projectId, task.id, advanced);
  const claim = useClaimTask(projectId);

  const patch = useTaskMutation(projectId, (change: Parameters<typeof payloadFromTask>[1]) => tasksApi.update(projectId, task.id, payloadFromTask(task, change)));
  const changeSprint = useTaskMutation(projectId, (sprintId: string | null) => tasksApi.changeSprint(projectId, task.id, sprintId));
  const changeLabels = useTaskMutation(projectId, (ids: string[]) => tasksApi.replaceLabels(projectId, task.id, ids));
  const unblock = useTaskMutation(projectId, () => tasksApi.setBlocked(projectId, task.id, false));
  const release = useTaskMutation(projectId, () => tasksApi.release(projectId, task.id), {
    onSuccess: () => toast.success(t("released", { key: task.taskKey })),
  });

  const canManage = perms.manage && !archived;
  const canWork = perms.work && !archived;
  const lockedManage = !canManage && !archived;
  const lockedWork = !canWork && !archived;

  const openSprints = (sprints.data ?? []).filter((sprint) => sprint.status !== "COMPLETED" || sprint.id === task.sprint?.id);
  const watcherList = watchers.data ?? [];
  const state = task.deadlineAt && task.status !== "DONE" ? deadlineState(task.deadlineAt) : null;

  return (
    <aside aria-label={t("title")} className="min-w-0 space-y-6">
      <dl className="@container divide-y rounded-xl border bg-card px-4">
        <PropertyRow label={t("status")}>
          <div className="space-y-2">
            <LockedHint locked={lockedWork} reason="assignee">
              <StatusMenu task={task} canChange={canWork} />
            </LockedHint>
            {task.blocked && (
              <p className="flex items-start gap-1.5 text-xs text-destructive">
                <LockSimple size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="break-words">{task.blockedReason ? t("blockedReason", { reason: task.blockedReason }) : tc("blocked.flag")}</span>
              </p>
            )}
            {task.hasOpenBlockers && !task.blocked && <p className="text-xs text-muted-foreground">{tc("blocked.byTask")}</p>}
            {task.blocked ? (
              <LockedHint locked={lockedWork} reason="assignee">
                <Button variant="outline" size="sm" disabled={!canWork || unblock.isPending} onClick={() => unblock.mutate(undefined)}>
                  {unblock.isPending ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <LockSimpleOpen aria-hidden="true" />}
                  {t("unblock")}
                </Button>
              </LockedHint>
            ) : (
              ctx.advancedWritable && task.status !== "DONE" && (
                <LockedHint locked={lockedWork} reason="assignee">
                  <Button variant="outline" size="sm" disabled={!canWork} onClick={() => setBlocking(true)}>
                    <LockSimple aria-hidden="true" />
                    {t("block")}
                  </Button>
                </LockedHint>
              )
            )}
          </div>
        </PropertyRow>

        <PropertyRow label={t("assignees")}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {task.assignees.length > 0 ? (
                <ul className="flex min-w-0 max-w-full flex-wrap gap-x-3 gap-y-1">
                  {task.assignees.map((person) => (
                    <li key={person.userId} className="flex min-w-0 max-w-full items-center gap-1.5 text-sm">
                      <Avatar name={person.nickname ?? "?"} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-5 text-[9px]" />
                      <span className="truncate">{person.nickname ?? "?"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <AssigneeAvatars people={[]} />
              )}
              <PoolMark task={task} />
            </div>
            <div className="flex flex-wrap gap-2">
              <LockedHint locked={lockedManage} reason="manager">
                <Button variant="outline" size="sm" className="h-auto min-h-7 max-w-full py-1 whitespace-normal" disabled={!canManage} onClick={() => setAssigning(true)}>
                  <UsersThree aria-hidden="true" />
                  {t("changeAssignees")}
                </Button>
              </LockedHint>
              {ctx.poolWritable && perms.canClaim && !archived && (
                <Button size="sm" disabled={claim.isPending} onClick={() => claim.mutate(task.id)}>
                  {claim.isPending ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <HandGrabbing aria-hidden="true" />}
                  {t("claim")}
                </Button>
              )}
              {ctx.poolWritable && perms.canRelease && !archived && (
                <Button variant="outline" size="sm" disabled={release.isPending} onClick={() => release.mutate(undefined)}>
                  {release.isPending ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <HandPalm aria-hidden="true" />}
                  {t("release")}
                </Button>
              )}
              {ctx.poolWritable && perms.manage && !archived && (task.pool?.open || task.pool?.claimed || task.pool?.teamId) && <ConfirmDialog
                trigger={<Button variant="outline" size="sm">{tm("clearPool")}</Button>}
                title={tm("clearPool")}
                description={tm("clearPoolDescription")}
                confirmLabel={tm("clearPool")}
                cancelLabel={tm("cancel")}
                onConfirm={() => patch.mutateAsync({ assigneeIds: task.assigneeIds, pool: { open: false, teamId: null } }).then(settle, settle)}
              />}
            </div>
          </div>
        </PropertyRow>

        <PropertyRow label={t("priority")} htmlFor="detail-priority">
          <LockedHint locked={lockedManage} reason="manager" className="w-full">
            <Select value={task.priority} disabled={!canManage || patch.isPending} onValueChange={(next) => next && next !== task.priority && patch.mutate({ priority: next as TaskPriority })}>
              <SelectTrigger id="detail-priority" size="sm" className="w-full">
                <SelectValue>
                  {(value: string) => (
                    <span className="flex items-center gap-2">
                      <PriorityIndicator priority={value as TaskPriority} />
                      {tc(`priority.${value}`)}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    <PriorityIndicator priority={priority} />
                    {tc(`priority.${priority}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LockedHint>
        </PropertyRow>

        {advanced && (
          <>
            <PropertyRow label={t("points")} htmlFor="detail-points">
              <LockedHint locked={lockedManage} reason="manager" className="w-full">
                <Select
                  value={task.estimatePoints === null ? NONE : String(task.estimatePoints)}
                  disabled={!advancedManage || patch.isPending}
                  onValueChange={(next) => {
                    if (next === null) return;
                    const points = next === NONE ? null : Number(next);
                    if (points !== task.estimatePoints) patch.mutate({ estimatePoints: points });
                  }}
                >
                  <SelectTrigger id="detail-points" size="sm" className="w-full">
                    <SelectValue>{(value: string) => (value === NONE ? t("noPoints") : tc("points", { count: Number(value) }))}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("noPoints")}</SelectItem>
                    {ESTIMATE_POINTS.map((points) => (
                      <SelectItem key={points} value={String(points)}>
                        {tc("points", { count: points })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LockedHint>
            </PropertyRow>

            <PropertyRow label={t("labels")}>
              {advancedManage ? (
                <LabelPicker
                  projectId={projectId}
                  slug={slug}
                  value={task.labels.map((label) => label.id)}
                  onChange={(ids) => changeLabels.mutate(ids)}
                  max={TASK_LABELS_MAX}
                />
              ) : task.labels.length > 0 ? (
                <LabelList labels={task.labels} max={task.labels.length} />
              ) : (
                <span className="text-muted-foreground">{t("none")}</span>
              )}
            </PropertyRow>

            <PropertyRow label={t("sprint")} htmlFor="detail-sprint">
              <LockedHint locked={lockedManage} reason="manager" className="w-full">
                <Select
                  value={task.sprint?.id ?? NONE}
                  disabled={!advancedManage || changeSprint.isPending || sprints.isPending}
                  onValueChange={(next) => {
                    if (next === null) return;
                    const sprintId = next === NONE ? null : next;
                    if (sprintId !== (task.sprint?.id ?? null)) changeSprint.mutate(sprintId);
                  }}
                >
                  <SelectTrigger id="detail-sprint" size="sm" className="w-full">
                    <SelectValue>
                      {(value: string) => (value === NONE ? t("backlog") : (openSprints.find((sprint) => sprint.id === value)?.name ?? task.sprint?.name ?? t("backlog")))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("backlog")}</SelectItem>
                    {openSprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LockedHint>
            </PropertyRow>

          </>
        )}
        <PropertyRow label={t("start")}>
          {task.startDate ? format.day(task.startDate) : <span className="text-muted-foreground">{t("none")}</span>}
        </PropertyRow>

        <PropertyRow label={t("deadline")}>
          {task.deadlineAt ? (
            <div className="space-y-0.5">
              <DeadlineChip task={task} className="text-sm" />
              {state && <p className={cn("text-xs", deadlineToneClass(state))}>{format.countdown(task.deadlineAt)}</p>}
            </div>
          ) : (
            <span className="text-muted-foreground">{t("none")}</span>
          )}
        </PropertyRow>
      </dl>

      {advanced && (
        <>
          <section aria-labelledby="detail-time" className="space-y-3">
            <h2 id="detail-time" className="text-sm font-semibold text-foreground">
              {t("time")}
            </h2>
            <TimeTracking {...ctx} />
          </section>

          <section aria-labelledby="detail-watchers" className="space-y-2">
            <h2 id="detail-watchers" className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
              {t("watchers")}
              {watcherList.length > 0 && <span className="text-xs font-normal text-muted-foreground tabular-nums">{watcherList.length}</span>}
            </h2>
            {watchers.isPending ? (
              <p className="text-xs text-muted-foreground">{t("loading")}</p>
            ) : watcherList.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noWatchers")}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {watcherList.slice(0, WATCHERS_SHOWN).map((person) => (
                  <li key={person.userId} className="flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-2 pl-0.5 text-xs">
                    <Avatar name={person.nickname ?? "?"} src={profilePhotoSrc(person.userId, person.profilePhotoVersion)} className="size-5 text-[9px]" />
                    <span className="max-w-28 truncate">{person.nickname ?? "?"}</span>
                  </li>
                ))}
                {watcherList.length > WATCHERS_SHOWN && (
                  <li className="flex items-center px-1 text-xs text-muted-foreground">{t("moreWatchers", { count: watcherList.length - WATCHERS_SHOWN })}</li>
                )}
              </ul>
            )}
          </section>

        </>
      )}
      <p className="space-y-0.5 text-xs leading-5 text-muted-foreground">
        <span className="block">{t("createdBy", { name: task.createdByName ?? "?", date: format.dateTime(task.createdAt) })}</span>
        <span className="block">{t("updatedBy", { name: task.updatedByName ?? task.createdByName ?? "?", date: format.dateTime(task.updatedAt) })}</span>
      </p>

      <BlockDialog task={task} open={blocking} onOpenChange={setBlocking} />
      <AssigneesDialog task={task} projectId={projectId} userId={userId} open={assigning} onOpenChange={setAssigning} />
    </aside>
  );
}
