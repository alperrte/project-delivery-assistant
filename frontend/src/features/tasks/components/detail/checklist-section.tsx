"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, CircleNotch, Lock, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { tasksApi } from "../../api";
import { useTaskFormat } from "../../format";
import { useChecklist, useTaskMutation } from "../../hooks";
import { CHECKLIST_MAX, CHECKLIST_TEXT_MAX } from "../../schemas";
import { DetailSection, type DetailContext } from "./detail-section";

export function ChecklistSection({ task, projectId, perms, advancedWritable }: DetailContext) {
  const t = useTranslations("tasks.detail.checklist");
  const tl = useTranslations("tasks.locked");
  const format = useTaskFormat();
  const [text, setText] = useState("");
  const checklist = useChecklist(projectId, task.id);
  const items = [...(checklist.data ?? [])].sort((a, b) => a.position - b.position);
  const editable = perms.work && advancedWritable && !task.archivedAt;

  const add = useTaskMutation(projectId, (value: string) => tasksApi.addChecklistItem(projectId, task.id, value), {
    onSuccess: () => setText(""),
  });
  const toggle = useTaskMutation(projectId, ({ id, done }: { id: string; done: boolean }) =>
    tasksApi.updateChecklistItem(projectId, task.id, id, { done }),
  );
  const remove = useTaskMutation(projectId, (id: string) => tasksApi.deleteChecklistItem(projectId, task.id, id));
  const reorder = useTaskMutation(projectId, (ids: string[]) => tasksApi.reorderChecklist(projectId, task.id, ids));

  function move(index: number, by: -1 | 1) {
    const ids = items.map((item) => item.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  }

  const total = task.checklistTotal;
  const done = task.checklistDone;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const trimmed = text.trim();
  const busy = toggle.isPending || remove.isPending || reorder.isPending;

  return (
    <DetailSection id="detail-checklist" title={t("title")} count={total > 0 ? `${done}/${total}` : undefined}>
      {total > 0 && (
        <Progress value={percent} aria-label={t("progress", { done, total })}>
          <ProgressTrack>
            <ProgressIndicator className={cn(done === total && "bg-success")} />
          </ProgressTrack>
        </Progress>
      )}

      {!editable && !task.archivedAt && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock size={12} aria-hidden="true" />
          {tl("assignee")}
        </p>
      )}

      {checklist.isPending ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((item, index) => (
            <li key={item.id} className="group flex items-center gap-3 px-3 py-2">
              <Checkbox
                checked={item.done}
                disabled={!editable || busy}
                aria-label={item.text}
                onCheckedChange={(checked) => toggle.mutate({ id: item.id, done: checked })}
              />
              <span
                className={cn("min-w-0 flex-1 text-sm break-words", item.done && "text-muted-foreground line-through")}
                title={item.done && item.doneAt ? t("doneAt", { date: format.dateTime(item.doneAt) }) : undefined}
              >
                {item.text}
              </span>
              {editable && (
                <span className="flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <Button variant="ghost" size="icon-xs" aria-label={t("moveUp", { text: item.text })} disabled={index === 0 || busy} onClick={() => move(index, -1)}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={t("moveDown", { text: item.text })} disabled={index === items.length - 1 || busy} onClick={() => move(index, 1)}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={t("remove", { text: item.text })} disabled={busy} onClick={() => remove.mutate(item.id)}>
                    <Trash aria-hidden="true" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable &&
        (items.length >= CHECKLIST_MAX ? (
          <p className="text-sm text-muted-foreground">{t("limit", { max: CHECKLIST_MAX })}</p>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (trimmed) add.mutate(trimmed);
            }}
          >
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={CHECKLIST_TEXT_MAX}
              autoComplete="off"
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              className="h-9"
            />
            <Button type="submit" variant="outline" size="lg" disabled={!trimmed || add.isPending}>
              {add.isPending ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {t("add")}
            </Button>
          </form>
        ))}
    </DetailSection>
  );
}
