"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleNotch, PaperPlaneRight, PencilSimple, Trash } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { Button } from "@/components/ui/button";
import { useTouchPrimaryInput } from "@/hooks/use-touch-primary-input";
import { cn } from "@/lib/utils";
import { tasksApi } from "../../api";
import { useTaskFormat } from "../../format";
import { useTaskMutation, useTimeline } from "../../hooks";
import { decodeMentions, encodeMentions, parseMentions } from "../../mentions";
import { canEditOwn } from "../../permissions";
import { COMMENT_MAX } from "../../schemas";
import type { Comment, PersonRef, TaskEvent, TimelineFilter } from "../../types";
import { useEventText } from "./activity-text";
import { DetailSection, settle, type DetailContext } from "./detail-section";
import { MentionTextarea } from "./mention-textarea";

const FILTERS: { value: TimelineFilter; key: "all" | "comments" | "history" }[] = [
  { value: "ALL", key: "all" },
  { value: "COMMENTS", key: "comments" },
  { value: "EVENTS", key: "history" },
];

function CommentBody({ comment }: { comment: Comment }) {
  const segments = parseMentions(comment.body ?? "", comment.mentions);
  return (
    <p className="text-sm break-words whitespace-pre-wrap text-foreground">
      {segments.map((segment, index) =>
        segment.type === "mention" ? (
          <span key={index} className="rounded-sm bg-primary/10 px-1 font-medium text-foreground">
            @{segment.value}
          </span>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </p>
  );
}

/** The keyboard contract of a comment box: Enter sends on desktop; on touch devices the button sends. */
function ComposerHint({ id }: { id: string }) {
  const t = useTranslations("tasks.detail.activity.composer");
  const touch = useTouchPrimaryInput();
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {touch ? t("hintTouch") : t("hint")}
    </p>
  );
}

function CommentRow({ comment, ctx }: { comment: Comment; ctx: DetailContext }) {
  const { projectId, task, userId, isManager } = ctx;
  const t = useTranslations("tasks.detail.activity");
  const format = useTaskFormat();
  const hintId = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<PersonRef[]>([]);
  const archived = !!task.archivedAt;

  const edit = useTaskMutation(projectId, (body: string) => tasksApi.editComment(projectId, task.id, comment.id, body), {
    onSuccess: () => setEditing(false),
  });
  const remove = useTaskMutation(projectId, () => tasksApi.deleteComment(projectId, task.id, comment.id));

  const own = comment.authorId === userId;
  const canEdit = own && !archived && !comment.deleted;
  const canDelete = canEditOwn(comment.authorId, userId, isManager) && !archived && !comment.deleted;
  const trimmed = text.trim();

  function startEdit() {
    setText(decodeMentions(comment.body ?? "", comment.mentions));
    setPicked(comment.mentions);
    setEditing(true);
  }

  function save() {
    if (trimmed && !edit.isPending) edit.mutate(encodeMentions(trimmed, picked));
  }

  return (
    <li className="group flex gap-3">
      <Avatar name={comment.authorName ?? "?"} src={profilePhotoSrc(comment.authorId, comment.authorPhotoVersion)} className="mt-0.5 size-7 shrink-0 text-[10px]" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{comment.authorName ?? t("events.someone")}</span>
          <time dateTime={comment.createdAt} title={format.dateTime(comment.createdAt)} className="text-xs text-muted-foreground">
            {format.relative(comment.createdAt)}
          </time>
          {comment.editedAt && !comment.deleted && (
            <span className="text-xs text-muted-foreground" title={format.dateTime(comment.editedAt)}>
              {t("edited")}
            </span>
          )}
          {(canEdit || canDelete) && !editing && (
            <span className="ml-auto flex items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              {canEdit && (
                <Button variant="ghost" size="icon-xs" aria-label={t("editComment")} onClick={startEdit}>
                  <PencilSimple aria-hidden="true" />
                </Button>
              )}
              {canDelete && (
                <ConfirmDialog
                  destructive
                  title={t("deleteTitle")}
                  description={t("deleteDescription")}
                  confirmLabel={t("delete")}
                  cancelLabel={t("cancel")}
                  onConfirm={() => remove.mutateAsync().then(settle, settle)}
                  trigger={
                    <Button variant="ghost" size="icon-xs" aria-label={t("deleteComment")}>
                      <Trash aria-hidden="true" />
                    </Button>
                  }
                />
              )}
            </span>
          )}
        </div>

        {comment.deleted ? (
          <p className="text-sm text-muted-foreground italic">{t("deleted")}</p>
        ) : editing ? (
          <div className="space-y-2">
            <MentionTextarea
              projectId={projectId}
              value={text}
              onChange={setText}
              onPick={(person) => setPicked((current) => (current.some((p) => p.userId === person.userId) ? current : [...current, person]))}
              onSubmit={save}
              describedBy={hintId}
              label={t("editComment")}
              maxLength={COMMENT_MAX}
              rows={3}
              autoFocus
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <ComposerHint id={hintId} />
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="lg" disabled={edit.isPending} onClick={() => setEditing(false)}>
                  {t("cancel")}
                </Button>
                <Button size="lg" disabled={!trimmed || edit.isPending} onClick={save}>
                  {edit.isPending && <CircleNotch className="animate-spin" aria-hidden="true" />}
                  {t("save")}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <CommentBody comment={comment} />
        )}
      </div>
    </li>
  );
}

function EventRow({ event, text }: { event: TaskEvent; text: string }) {
  const t = useTranslations("tasks.detail.activity");
  const format = useTaskFormat();
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center" aria-hidden="true">
        <span className="size-1.5 rounded-full bg-border-strong" />
      </span>
      <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">{event.actorName ?? t("events.someone")}</span> {text}
        <span aria-hidden="true"> · </span>
        <time dateTime={event.createdAt} title={format.dateTime(event.createdAt)}>
          {format.relative(event.createdAt)}
        </time>
      </p>
    </li>
  );
}

export function ActivitySection(ctx: DetailContext & { focusComments?: boolean }) {
  const { task, projectId } = ctx;
  const t = useTranslations("tasks.detail.activity");
  const hintId = useId();
  const [filter, setFilter] = useState<TimelineFilter>(ctx.focusComments ? "COMMENTS" : "ALL");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<PersonRef[]>([]);
  const timeline = useTimeline(projectId, task.id, filter);
  const eventText = useEventText(projectId, task.creationMode === "ADVANCED");

  const add = useTaskMutation(projectId, (body: string) => tasksApi.addComment(projectId, task.id, body), {
    onSuccess: () => {
      setText("");
      setPicked([]);
    },
  });

  const trimmed = text.trim();
  const entries = timeline.data?.content ?? [];
  const total = timeline.data?.totalElements ?? 0;

  function submit() {
    if (trimmed && !add.isPending) add.mutate(encodeMentions(trimmed, picked));
  }

  return (
    <DetailSection
      id="detail-activity"
      title={t("title")}
      action={
        <div role="group" aria-label={t("filter")} className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "h-6 rounded-md px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                filter === item.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filters.${item.key}`)}
            </button>
          ))}
        </div>
      }
    >
      {!task.archivedAt && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <MentionTextarea
            projectId={projectId}
            value={text}
            onChange={setText}
            onPick={(person) => setPicked((current) => (current.some((p) => p.userId === person.userId) ? current : [...current, person]))}
            onSubmit={submit}
            describedBy={hintId}
            autoFocus={ctx.focusComments}
            label={t("composer.label")}
            placeholder={t("composer.placeholder")}
            maxLength={COMMENT_MAX}
            rows={3}
          />
          <div className="flex items-center justify-between gap-3">
            <ComposerHint id={hintId} />
            <Button type="submit" size="lg" disabled={!trimmed || add.isPending}>
              {add.isPending ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <PaperPlaneRight aria-hidden="true" />}
              {t("composer.submit")}
            </Button>
          </div>
        </form>
      )}

      {timeline.isPending ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="space-y-4" aria-label={t("title")}>
          {entries.map((entry) =>
            entry.kind === "COMMENT" ? (
              <CommentRow key={`c-${entry.comment.id}`} comment={entry.comment} ctx={ctx} />
            ) : (
              <EventRow key={`e-${entry.event.id}`} event={entry.event} text={eventText(entry.event)} />
            ),
          )}
        </ol>
      )}

      {total > entries.length && <p className="text-xs text-muted-foreground">{t("truncated", { shown: entries.length, total })}</p>}
    </DetailSection>
  );
}
