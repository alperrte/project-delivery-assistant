"use client";
/* eslint-disable @next/next/no-img-element -- Private cookie-authenticated media and local blob previews cannot use the image proxy. */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PaperPlaneRight, Paperclip, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MESSAGE_MAX_LENGTH, messageLength, normalizeMessage, validateMessage } from "../limits";
import type { ChatReply } from "../types";
import { ReplyPreview } from "./reply-preview";
import { COMPOSER_CHOICES, insertEmoji } from "../emoji-catalog";
import { EmojiPicker } from "./emoji-picker";
import { toast } from "sonner";

type Props = {
  /** Draft slot: the draft survives the panel changing state and switching to another conversation and back. */
  draftKey: string;
  initialDraft: string;
  onDraftChange: (text: string) => void;
  /** Hands a valid text over for sending. */
  onSend: (text: string, file?: File) => Promise<boolean>;
  /** Nothing can be sent right now (no conversation yet, or the connection is down). */
  disabled: boolean;
  disabledReason?: string;
  autoFocus?: boolean;
  reply?: ChatReply | null;
  onCancelReply?: () => void;
  /** Reports typing activity: keystrokes, an emptied box, a sent message. The owner throttles what goes out. */
  onTyping?: (state: "typing" | "stopped" | "sent") => void;
};

/**
 * The message box: Enter sends, Shift+Enter starts a new line, the counter mirrors the 2000 character limit. The
 * checks here only save a round trip, the server validates again.
 */
export function MessageComposer({ draftKey, initialDraft, onDraftChange, onSend, disabled, disabledReason, autoFocus, reply, onCancelReply, onTyping }: Props) {
  const t = useTranslations("chat");
  const locale=useLocale();
  const [text, setText] = useState(initialDraft);
  const [file,setFile]=useState<File>();
  const [preview,setPreview]=useState<string>();
  const [uploading,setUploading]=useState(false);
  const sending=useRef(false);
  const fileInput=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  function chooseFile(selected?:File) {
    if(!selected)return;
    if(selected.size>2097152){toast.error(t("files.tooLarge"));return;}
    if(selected.size===0||! /\.(pdf|docx?|jpe?g|png|webp)$/i.test(selected.name)){toast.error(t("files.invalid"));return;}
    setPreview(selected.type.startsWith("image/")?URL.createObjectURL(selected):undefined);
    setFile(selected);
  }
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();
  const statusId = useId();

  useEffect(() => {
    // Focus the box on desktop widths; on a phone the keyboard would cover the history the user just opened.
    if (autoFocus && window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
  }, [autoFocus, draftKey]);
  useEffect(() => { if (reply) inputRef.current?.focus(); }, [reply]);

  const validation = validateMessage(text);
  const length = messageLength(normalizeMessage(text));
  const overLimit = length > MESSAGE_MAX_LENGTH;
  // An empty box is not an error; a too long text or forbidden characters are, as soon as they are typed.
  const problem = !validation.ok && validation.error !== "empty" ? validation.error : null;
  const problemText = problem === "tooLong" ? t("validation.tooLong", { max: MESSAGE_MAX_LENGTH }) : problem ? t(`validation.${problem}`) : null;

  function change(value: string) {
    setText(value);
    onDraftChange(value);
    onTyping?.(value.trim() === "" ? "stopped" : "typing");
  }

  async function submit() {
    if(disabled||sending.current||(!validation.ok&&!file)||problem)return;
    sending.current=true;setUploading(true);
    try {if(await onSend(text,file)){onTyping?.("sent");setText("");setFile(undefined);setPreview(undefined);onDraftChange("");inputRef.current?.focus();}}
    finally{sending.current=false;setUploading(false);}
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter during IME composition confirms the candidate; it must not send.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="shrink-0 border-t bg-background p-3"
      onKeyDown={event => { if (event.key === "Escape" && reply && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onCancelReply?.(); } }}
    >
      {file&&<div className="mb-2 flex min-w-0 items-center gap-2 rounded-md border p-2" data-testid="chat-file-preview">
        {preview&&<img width={48} height={48} src={preview} alt={file.name} className="size-12 rounded object-cover"/>}
        <span className="min-w-0 flex-1"><span className="block truncate text-sm">{file.name}</span><span className="text-xs text-muted-foreground">{file.type||file.name.split(".").pop()} · {new Intl.NumberFormat(locale,{style:"unit",unit:"kilobyte",maximumFractionDigits:1}).format(file.size/1024)}</span></span>
        <Button type="button" variant="ghost" size="icon" aria-label={t("files.remove")} disabled={uploading} onClick={()=>{setFile(undefined);setPreview(undefined);}}><X aria-hidden="true"/></Button>
      </div>}
      {uploading&&<p role="status" className="mb-2 text-xs text-muted-foreground">{t("files.sending")}</p>}
      {reply && <div data-testid="chat-reply-context" className="mb-2 flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1"><ReplyPreview reply={reply} /></div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("reply.cancel")} data-testid="chat-reply-cancel"
          className="shrink-0 max-sm:size-11" onClick={() => { onCancelReply?.(); inputRef.current?.focus(); }}><X aria-hidden="true" /></Button>
      </div>}
      {disabledReason && (
        <p id={statusId} role="status" data-testid="chat-disabled-reason" className="mb-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          {disabledReason}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileInput} type="file" name="attachment" aria-label={t("files.add")} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={e=>{chooseFile(e.target.files?.[0]);e.target.value="";}}/>
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("files.add")} disabled={disabled||uploading} onClick={()=>fileInput.current?.click()}><Paperclip aria-hidden="true"/></Button>
        <div className="relative min-w-0 flex-1">
        <Textarea
          data-workspace-scroll=""
          ref={inputRef}
          value={text}
          onChange={(event) => change(event.target.value)}
          onKeyDown={keyDown}
          disabled={disabled||uploading}
          rows={1}
          aria-label={t("composerLabel")}
          aria-describedby={[problemText ? hintId : null, disabledReason ? statusId : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={problem ? true : undefined}
          placeholder={t("composerPlaceholder")}
          data-testid="chat-composer"
          className="max-h-32 min-h-11 resize-none py-2 pr-12"
        />
        <div className="absolute right-0.5 bottom-0.5">
          <EmojiPicker choices={COMPOSER_CHOICES} label={t("emoji.action")} testId="chat-composer-emoji" disabled={disabled} finalFocus={inputRef}
            onChoose={choice=>{
              const input=inputRef.current;
              const inserted=insertEmoji(text,input?.selectionStart??text.length,input?.selectionEnd??text.length,choice.emoji);
              const check=validateMessage(inserted.text);
              if(!check.ok&&check.error==="tooLong"){toast.error(t("validation.tooLong",{max:MESSAGE_MAX_LENGTH}));return;}
              change(inserted.text);
              requestAnimationFrame(()=>{inputRef.current?.focus();inputRef.current?.setSelectionRange(inserted.caret,inserted.caret);});
            }} />
        </div>
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={disabled || uploading || (!validation.ok&&!file) || !!problem}
          aria-label={t("send")}
          data-testid="chat-send"
          className="size-11 shrink-0"
        >
          <PaperPlaneRight weight="fill" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-3 text-[11px] text-muted-foreground">
        {problemText && <span id={hintId} role="alert" className="min-w-0 flex-1 truncate text-destructive">{problemText}</span>}
        <span className={cn("shrink-0 tabular-nums", overLimit && "font-semibold text-destructive")} aria-hidden="true">
          {t("counter", { count: length, max: MESSAGE_MAX_LENGTH })}
        </span>
      </div>
    </form>
  );
}
