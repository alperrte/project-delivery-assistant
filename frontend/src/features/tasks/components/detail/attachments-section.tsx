/* eslint-disable @next/next/no-img-element -- attachments are authenticated API images; next/image optimisation does not apply. */
"use client";

import { useRef, useState, type DragEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleNotch, DownloadSimple, FileText, Trash, UploadSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { attachmentContentUrl, isPreviewableImage, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, tasksApi } from "../../api";
import { useTaskFormat } from "../../format";
import { useAttachments, useTaskMutation } from "../../hooks";
import { canEditOwn } from "../../permissions";
import type { Attachment } from "../../types";
import { DetailSection, settle, type DetailContext } from "./detail-section";

function useBytes() {
  const locale = useLocale();
  return (bytes: number) => {
    const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${number(bytes / 1024)} KB`;
    return `${number(bytes / (1024 * 1024))} MB`;
  };
}

function AttachmentCard({ attachment, ctx, onDelete }: { attachment: Attachment; ctx: DetailContext; onDelete: () => Promise<void> }) {
  const t = useTranslations("tasks.detail.attachments");
  const format = useTaskFormat();
  const bytes = useBytes();
  const [broken, setBroken] = useState(false);
  const url = attachmentContentUrl(ctx.projectId, ctx.task.id, attachment.id);
  const image = isPreviewableImage(attachment.contentType) && !broken;
  const removable = canEditOwn(attachment.uploadedBy, ctx.userId, ctx.isManager) && ctx.advancedWritable && !ctx.task.archivedAt;

  return (
    <li className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
      {image ? (
        <a href={url} target="_blank" rel="noreferrer" aria-label={t("open", { name: attachment.fileName })} className="block aspect-video overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
          <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
        </a>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground" aria-hidden="true">
          <FileText size={28} />
        </div>
      )}
      <div className="flex items-start gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground" title={attachment.fileName}>{attachment.fileName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {bytes(attachment.sizeBytes)} · {attachment.uploadedByName ?? "?"} · {format.relative(attachment.uploadedAt)}
          </p>
        </div>
        <a
          href={url}
          download={attachment.fileName}
          aria-label={t("download", { name: attachment.fileName })}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <DownloadSimple size={14} aria-hidden="true" />
        </a>
        {removable && (
          <ConfirmDialog
            destructive
            title={t("deleteTitle")}
            description={t("deleteDescription", { name: attachment.fileName })}
            confirmLabel={t("delete")}
            cancelLabel={t("cancel")}
            onConfirm={onDelete}
            trigger={
              <Button variant="ghost" size="icon-xs" aria-label={t("deleteName", { name: attachment.fileName })}>
                <Trash aria-hidden="true" />
              </Button>
            }
          />
        )}
      </div>
    </li>
  );
}

export function AttachmentsSection(ctx: DetailContext) {
  const { task, projectId } = ctx;
  const t = useTranslations("tasks.detail.attachments");
  const bytes = useBytes();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const attachments = useAttachments(projectId, task.id);
  const list = attachments.data ?? [];
  const canUpload = ctx.advancedWritable && !task.archivedAt;

  const upload = useTaskMutation(projectId, (file: File) => tasksApi.uploadAttachment(projectId, task.id, file));
  const remove = useTaskMutation(projectId, (id: string) => tasksApi.deleteAttachment(projectId, task.id, id));

  async function send(files: File[]) {
    if (files.length === 0) return;
    const room = MAX_ATTACHMENTS - list.length;
    if (room <= 0) {
      toast.error(t("limit", { max: MAX_ATTACHMENTS }));
      return;
    }
    const accepted = files.filter((file) => file.size <= MAX_ATTACHMENT_BYTES).slice(0, room);
    if (accepted.length < files.length) toast.error(t("skipped", { max: bytes(MAX_ATTACHMENT_BYTES) }));
    setUploading(accepted.length);
    for (const file of accepted) {
      try {
        await upload.mutateAsync(file);
      } catch {
        // `useTaskMutation` already reported it (type, size or quota), so the remaining files still go up.
      }
      setUploading((count) => count - 1);
    }
    if (input.current) input.current.value = "";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (canUpload) void send(Array.from(event.dataTransfer.files));
  }

  return (
    <DetailSection id="detail-attachments" title={t("title")} count={list.length > 0 ? `${list.length}/${MAX_ATTACHMENTS}` : undefined}>
      {list.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((attachment) => (
            <AttachmentCard key={attachment.id} attachment={attachment} ctx={ctx} onDelete={() => remove.mutateAsync(attachment.id).then(settle, settle)} />
          ))}
        </ul>
      )}

      {attachments.isPending && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

      {canUpload && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border-strong",
          )}
        >
          <UploadSimple size={18} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("drop")}</p>
          <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => void send(Array.from(event.target.files ?? []))} />
          <Button variant="outline" size="lg" disabled={uploading > 0} onClick={() => input.current?.click()}>
            {uploading > 0 ? <CircleNotch className="animate-spin" aria-hidden="true" /> : <UploadSimple aria-hidden="true" />}
            {uploading > 0 ? t("uploading", { count: uploading }) : t("choose")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("hint", { size: bytes(MAX_ATTACHMENT_BYTES), max: MAX_ATTACHMENTS })}</p>
          <p role="status" aria-live="polite" className="sr-only">{uploading > 0 ? t("uploading", { count: uploading }) : ""}</p>
        </div>
      )}
    </DetailSection>
  );
}
