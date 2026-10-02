/* eslint-disable @next/next/no-img-element -- the preview is a local object URL; next/image optimisation does not apply. */
"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { UploadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BANNER_MAX_BYTES } from "../banner-field";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

type BannerPickFieldProps = {
  previewUrl: string | null;
  onChange: (file: File | null) => void;
};

/**
 * Picks the cover image while a project is being created, like `LogoField` does for the logo: the file is held in the
 * form, shown live on the preview card, and uploaded once the project exists. Client checks only save a round trip;
 * the server re-validates by magic bytes.
 */
export function BannerPickField({ previewUrl, onChange }: BannerPickFieldProps) {
  const t = useTranslations("projects.newPage.banner");
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
    if (file.size > BANNER_MAX_BYTES) {
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
          className="grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/25 bg-primary/10 text-primary"
        >
          {previewUrl ? <img src={previewUrl} alt="" className="size-full object-cover" /> : <UploadSimple size={22} />}
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
