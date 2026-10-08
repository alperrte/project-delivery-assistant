"use client";
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { UploadSimple, ImageSquare } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IMAGE_TYPES, imageValidationError, canDecodeImage } from "@/lib/media/image-validation";
import { EntityMark } from "./entity-mark";
import { EntityCover } from "./entity-cover";
export type ImagePickerLabels = { label: string; choose: string; change: string; remove: string; hint: string; invalidType: string; tooLarge: string; empty: string; detail?: string };
export function ImagePicker({ name = "", src, onChange, maximum, labels, cover = false, disabled = false, removeControl, tile = false, decodeError }: {
  name?: string; src: string | null; onChange: (file: File | null) => void; maximum: number; labels: ImagePickerLabels;
  cover?: boolean; disabled?: boolean; removeControl?: ReactNode; tile?: boolean; decodeError?: string;
}) {
  const id = useId(); const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null); const [dragging, setDragging] = useState(false);
  const generation = useRef(0);
  const [checking, setChecking] = useState(false);
  useEffect(() => () => { generation.current++; }, []);
  async function accept(file?: File) {
    if (!file || disabled) return;
    const ticket = ++generation.current;
    setChecking(false);
    const invalid = imageValidationError(file, maximum);
    if (invalid) { setError(labels[invalid]); return; }
    if (decodeError) {
      setChecking(true);
      const valid = await canDecodeImage(file);
      if (generation.current !== ticket) return;
      setChecking(false);
      if (!valid) { setError(decodeError); return; }
    }
    setError(null); onChange(file);
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files[0]); }
  return <div className={tile ? "flex h-full flex-col gap-1.5" : "space-y-1.5"}>
    <label htmlFor={id} className="text-sm font-medium">{labels.label}</label>
    <div onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}
      className={cn("flex items-center gap-4 rounded-xl border border-dashed bg-surface-2/40 p-3 transition-colors", dragging ? "border-primary bg-primary/5" : "border-border", error && "border-destructive", tile && "flex-1 gap-3")}>
      <span aria-hidden="true" className={cn("grid shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/25 bg-primary/10 font-heading text-2xl font-semibold text-primary", tile ? "size-12 bg-muted text-foreground border-border" : cover ? "h-16 w-24 sm:w-28" : "size-16")}>
        {tile && !src ? (cover ? <ImageSquare size={24}/> : <UploadSimple size={24}/>) : cover ? <EntityCover src={src} className="h-full aspect-auto sm:aspect-auto" /> : <EntityMark name={name} src={src} />}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant={tile ? "ghost" : "outline"} className={cn(tile && "h-auto whitespace-normal px-0 py-0 text-left hover:bg-transparent", decodeError && "min-h-11 sm:min-h-8")} size="sm" disabled={disabled} onClick={() => input.current?.click()}>{!tile && <UploadSimple size={14} aria-hidden="true" />}{src ? labels.change : labels.choose}</Button>
          {src && (removeControl ?? <Button type="button" variant="ghost" size="sm" className={decodeError ? "min-h-11 sm:min-h-8" : undefined} disabled={disabled} onClick={() => { generation.current++; setChecking(false); setError(null); onChange(null); }}>{labels.remove}</Button>)}
        </div>
        <p id={`${id}-hint`} className={cn("text-muted-foreground",tile ? "text-xs leading-5" : "text-sm")}>{labels.hint}</p>
        {labels.detail && <p className="text-xs leading-5 text-muted-foreground">{labels.detail}</p>}
      </div>
      <input ref={input} id={id} type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" disabled={disabled} aria-busy={checking} aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        onChange={(event) => { accept(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
