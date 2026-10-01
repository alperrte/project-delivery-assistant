"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectMark } from "../project-card";

export const LOGO_MAX_BYTES = 512 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

type LogoFieldProps = {
  name: string;
  previewUrl: string | null;
  onChange: (file: File | null) => void;
};

/** Client-side checks only save a round trip; the server re-validates by magic bytes. */
export function LogoField({ name, previewUrl, onChange }: LogoFieldProps) {
  const t = useTranslations("projects.newPage.logo");
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function accept(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError(t("invalidType"));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError(t("tooLarge"));
      return;
    }
    setError(null);
    onChange(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files[0]);
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {t("label")}
      </label>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex items-center gap-4 rounded-xl border border-dashed bg-surface-2/40 p-3 transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border",
          error && "border-destructive",
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 font-heading text-2xl font-semibold text-primary"
        >
          <ProjectMark key={previewUrl ?? "none"} name={name} src={previewUrl} />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <UploadSimple size={14} data-icon="inline-start" aria-hidden="true" />
              {previewUrl ? t("change") : t("choose")}
            </Button>
            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
              >
                {t("remove")}
              </Button>
            )}
          </div>
          <p id={hintId} className="text-sm text-muted-foreground">
            {t("hint")}
          </p>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          aria-describedby={hintId}
          onChange={(event) => {
            accept(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
