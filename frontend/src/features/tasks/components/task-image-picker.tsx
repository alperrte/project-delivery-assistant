/* eslint-disable @next/next/no-img-element -- previews are local blob URLs of the picked files; next/image optimisation does not apply. */
"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { UploadSimple, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { canDecodeImage, imageValidationError } from "@/lib/media/image-validation";
import { cn } from "@/lib/utils";
import { MAX_ATTACHMENTS, MAX_IMAGE_BYTES } from "../api";

type Rejected = { invalidType: number; tooLarge: number; undecodable: number; limit: number };

const fileId = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

/** The blob URL lives exactly as long as the `<img>`: the ref callback creates it and its cleanup revokes it (also under StrictMode). */
function Thumbnail({ file }: { file: File }) {
  const attach = useCallback((img: HTMLImageElement | null) => {
    if (!img) return;
    const url = URL.createObjectURL(file);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={attach} alt="" className="size-full object-cover" />;
}

/** Images chosen on the create form; they are uploaded one by one after the task exists. */
export function TaskImagePicker({ files, onChange, disabled }: { files: File[]; onChange: (next: File[]) => void; disabled?: boolean }) {
  const t = useTranslations("tasks.form.images");
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(files);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<Rejected | null>(null);

  useEffect(() => {
    latest.current = files;
  }, [files]);

  async function pick(picked: File[]) {
    if (picked.length === 0) return;
    const added: File[] = [];
    const refused: Rejected = { invalidType: 0, tooLarge: 0, undecodable: 0, limit: 0 };
    for (const file of picked) {
      const id = fileId(file);
      if (latest.current.some((current) => fileId(current) === id) || added.some((current) => fileId(current) === id)) continue;
      if (latest.current.length + added.length >= MAX_ATTACHMENTS) {
        refused.limit += 1;
        continue;
      }
      const error = imageValidationError(file, MAX_IMAGE_BYTES);
      if (error === "invalidType") refused.invalidType += 1;
      else if (error === "tooLarge") refused.tooLarge += 1;
      else if (error === "empty" || !(await canDecodeImage(file))) refused.undecodable += 1;
      else added.push(file);
    }
    const hasRefused = Object.values(refused).some((count) => count > 0);
    setRejected(hasRefused ? refused : null);
    if (added.length > 0) onChange([...latest.current, ...added].slice(0, MAX_ATTACHMENTS));
  }

  function choose(list: FileList | null) {
    const picked = Array.from(list ?? []);
    // Cleared so the same file can be picked again after it was removed.
    if (input.current) input.current.value = "";
    void pick(picked);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) void pick(Array.from(event.dataTransfer.files));
  }

  function remove(target: File) {
    setRejected(null);
    onChange(files.filter((file) => file !== target));
  }

  return (
    <div className="space-y-3">
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
        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onChange={(event) => choose(event.target.files)}
        />
        <Button type="button" variant="outline" size="lg" disabled={disabled || files.length >= MAX_ATTACHMENTS} onClick={() => input.current?.click()}>
          <UploadSimple aria-hidden="true" />
          {t("choose")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("hint", { size: "1 MB", max: MAX_ATTACHMENTS })}</p>
      </div>

      {rejected && (
        <div role="alert" className="space-y-0.5 text-sm text-destructive">
          {rejected.invalidType > 0 && <p>{t("invalidType", { count: rejected.invalidType })}</p>}
          {rejected.tooLarge > 0 && <p>{t("tooLarge", { count: rejected.tooLarge, size: "1 MB" })}</p>}
          {rejected.undecodable > 0 && <p>{t("undecodable", { count: rejected.undecodable })}</p>}
          {rejected.limit > 0 && <p>{t("limit", { count: rejected.limit, max: MAX_ATTACHMENTS })}</p>}
        </div>
      )}

      {files.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="task-image-previews">
          {files.map((file) => (
            <li key={fileId(file)} className="flex min-w-0 flex-col gap-1">
              <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
                <Thumbnail file={file} />
              </div>
              <div className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={file.name}>{file.name}</span>
                <Button type="button" variant="ghost" size="icon-xs" disabled={disabled} aria-label={t("remove", { name: file.name })} onClick={() => remove(file)}>
                  <X aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
