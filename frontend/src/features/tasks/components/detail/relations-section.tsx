"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CircleNotch, Plus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { tasksApi } from "../../api";
import { useRelations, useTaskMutation } from "../../hooks";
import type { RelatedTask, RelationType, TaskRef } from "../../types";
import { StatusDot } from "../task-badges";
import { ParentPicker } from "../task-form-fields";
import { DetailSection, type DetailContext } from "./detail-section";

const TYPES: RelationType[] = ["BLOCKS", "RELATES", "DUPLICATES"];
const GROUPS = ["blockedBy", "blocks", "relatesTo", "duplicates", "duplicatedBy"] as const;

function RelatedRow({ related, slug, removable, onRemove, removing, removeLabel }: { related: RelatedTask; slug: string; removable: boolean; onRemove: () => void; removing: boolean; removeLabel: string }) {
  return (
    <li className="group flex items-center gap-1 pr-1.5">
      <Link
        href={`/projects/${slug}/tasks/${related.taskId}`}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
      >
        <StatusDot status={related.status} />
        <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{related.key}</span>
        <span className={cn("min-w-0 flex-1 truncate", related.status === "DONE" && "text-muted-foreground line-through")}>{related.title}</span>
      </Link>
      {removable && (
        <Button variant="ghost" size="icon-xs" aria-label={removeLabel} disabled={removing} onClick={onRemove} className="sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <X aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

export function RelationsSection({ task, slug, projectId, perms, advancedWritable }: DetailContext) {
  const t = useTranslations("tasks.detail.relations");
  const relations = useRelations(projectId, task.id);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<RelationType>("RELATES");
  const [target, setTarget] = useState<TaskRef | null>(null);
  const editable = perms.work && advancedWritable && !task.archivedAt;

  const add = useTaskMutation(projectId, ({ kind, id }: { kind: RelationType; id: string }) => tasksApi.addRelation(projectId, task.id, kind, id), {
    onSuccess: () => {
      setTarget(null);
      setAdding(false);
    },
  });
  const remove = useTaskMutation(projectId, (relationId: string) => tasksApi.removeRelation(projectId, task.id, relationId));

  const data = relations.data;
  const total = data ? GROUPS.reduce((sum, group) => sum + data[group].length, 0) : 0;
  const related = data ? GROUPS.flatMap((group) => data[group].map((item) => item.taskId)) : [];

  return (
    <DetailSection
      id="detail-relations"
      title={t("title")}
      count={total > 0 ? String(total) : undefined}
      action={
        editable && !adding ? (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            {t("add")}
          </Button>
        ) : undefined
      }
    >
      {relations.isPending ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : total === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          {GROUPS.map((group) =>
            data && data[group].length > 0 ? (
              <div key={group} className="space-y-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">{t(`groups.${group}`)}</h3>
                <ul className="divide-y rounded-xl border bg-card">
                  {data[group].map((item) => (
                    <RelatedRow
                      key={item.relationId}
                      related={item}
                      slug={slug}
                      removable={editable}
                      removing={remove.isPending}
                      removeLabel={t("remove", { key: item.key })}
                      onRemove={() => remove.mutate(item.relationId)}
                    />
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}

      {editable && adding && (
        <div className="space-y-3 rounded-xl border bg-card p-3">
          <div className="space-y-1.5">
            <span id="relation-type-label" className="text-xs font-medium text-muted-foreground">{t("type")}</span>
            <Select value={type} onValueChange={(next) => next && setType(next as RelationType)}>
              <SelectTrigger aria-labelledby="relation-type-label" className="w-full">
                <SelectValue>{(value: string) => t(`types.${value}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t(`types.${kind}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ParentPicker
            projectId={projectId}
            value={target}
            onChange={setTarget}
            excludeId={task.id}
            excludeIds={related}
            topLevelOnly={false}
            placeholder={t("search")}
            searchLabel={t("search")}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setAdding(false);
                setTarget(null);
              }}
              disabled={add.isPending}
            >
              {t("cancel")}
            </Button>
            <Button size="lg" disabled={!target || add.isPending} onClick={() => target && add.mutate({ kind: type, id: target.id })}>
              {add.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
              {t("submit")}
            </Button>
          </div>
        </div>
      )}
    </DetailSection>
  );
}
