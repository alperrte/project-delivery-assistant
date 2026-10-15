"use client";
/* eslint-disable @next/next/no-img-element -- Private cookie-authenticated media and local blob previews cannot use the image proxy. */

import { useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from "react";
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
  ref?: Ref<ComposerHandle>;
  /** Draft slot: the draft survives the panel changing state and switching to another conversation and back. */
  draftKey: string;
  initialDraft: string;
  onDraftChange: (text: string) => void;
  /** Hands a valid text over for sending. */
  onSend: (text: string, file?: File, includeReply?: boolean) => Promise<boolean>;
  /** Nothing can be sent right now (no conversation yet, or the connection is down). */
  disabled: boolean;
  disabledReason?: string;
  autoFocus?: boolean;
  reply?: ChatReply | null;
  onCancelReply?: () => void;
  /** Reports typing activity: keystrokes, an emptied box, a sent message. The owner throttles what goes out. */
  onTyping?: (state: "typing" | "stopped" | "sent") => void;
};
export type ComposerHandle = { addFiles: (files: File[]) => void; acceptsFiles: () => boolean };
type DraftAttachment = { id: number; file: File; preview?: string };

/**
 * The message box: Enter sends, Shift+Enter starts a new line, the counter mirrors the 2000 character limit. The
 * checks here only save a round trip, the server validates again.
 */
export function MessageComposer({ ref, draftKey, initialDraft, onDraftChange, onSend, disabled, disabledReason, autoFocus, reply, onCancelReply, onTyping }: Props) {
  const t = useTranslations("chat");
  const locale=useLocale();
  const [text, setText] = useState(initialDraft);
  const [attachments,setAttachments]=useState<DraftAttachment[]>([]);
  const attachmentRef=useRef<DraftAttachment[]>([]), nextId=useRef(0), mounted=useRef(true);
  const [uploading,setUploading]=useState(false);
  const sending=useRef(false);
  const fileInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;attachmentRef.current.forEach(item=>{if(item.preview)URL.revokeObjectURL(item.preview);});};},[]);
  function removeFile(id:number) {
    const item=attachmentRef.current.find(item=>item.id===id);if(item?.preview)URL.revokeObjectURL(item.preview);
    attachmentRef.current=attachmentRef.current.filter(item=>item.id!==id);if(mounted.current)setAttachments([...attachmentRef.current]);
  }
  function addFiles(files:File[]) {
    if(disabled||sending.current)return;
    const added:DraftAttachment[]=[];
    for(const selected of files){
      if(selected.size>2097152){toast.error(t("files.tooLarge"));continue;}
      if(selected.size===0||! /\.(pdf|docx?|jpe?g|png|webp|env|md)$/i.test(selected.name)){toast.error(t("files.invalid"));continue;}
      if([...attachmentRef.current,...added].some(item=>item.file.name===selected.name&&item.file.size===selected.size&&item.file.lastModified===selected.lastModified&&item.file.type===selected.type))continue;
      added.push({id:++nextId.current,file:selected,preview:selected.type.startsWith("image/")?URL.createObjectURL(selected):undefined});
    }
    attachmentRef.current=[...attachmentRef.current,...added];setAttachments(attachmentRef.current);
  }
  useImperativeHandle(ref,()=>({addFiles,acceptsFiles:()=>!disabled&&!sending.current}));
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
    if(disabled||sending.current||(!validation.ok&&!attachments.length)||problem)return;
    sending.current=true;setUploading(true);
    try {
      const queue=[...attachmentRef.current];let first=true;
      for(const item of queue.length?queue:[undefined]){
        if(!mounted.current)break;
        if(!await onSend(first?text:"",item?.file,first))break;
        if(!mounted.current)break;
        if(item)removeFile(item.id);
        if(first){onTyping?.("sent");setText("");onDraftChange("");first=false;}
      }
      if(mounted.current)inputRef.current?.focus();
    } finally{sending.current=false;if(mounted.current)setUploading(false);}
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
      {attachments.length>0&&<div data-workspace-scroll="" className="mb-2 max-h-36 space-y-1 overflow-y-auto overscroll-contain">{attachments.map(({id,file,preview})=><div key={id} className="flex min-w-0 items-center gap-2 rounded-md border p-2" data-testid="chat-file-preview">
        {preview?<img loading="lazy" decoding="async" width={48} height={48} src={preview} alt={file.name} className="size-12 rounded object-cover"/>:<Paperclip size={24} aria-hidden="true" className="shrink-0 text-muted-foreground"/>}
        <span className="min-w-0 flex-1"><span className="block truncate text-sm">{file.name}</span><span className="text-xs text-muted-foreground">{file.type||file.name.split(".").pop()} · {new Intl.NumberFormat(locale,{style:"unit",unit:"kilobyte",maximumFractionDigits:1}).format(file.size/1024)}</span></span>
        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t("files.remove")} disabled={uploading} onClick={()=>removeFile(id)}><X aria-hidden="true"/></Button>
      </div>)}</div>}
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
        <input ref={fileInput} type="file" multiple disabled={disabled||uploading} name="attachment" aria-label={t("files.add")} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.env,.md" onChange={e=>{addFiles(Array.from(e.target.files??[]));e.target.value="";}}/>
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("files.add")} disabled={disabled||uploading} onClick={()=>fileInput.current?.click()}><Paperclip aria-hidden="true"/></Button>
        <div className="relative min-w-0 flex-1">
        <Textarea
          data-workspace-scroll=""
          ref={inputRef}
          value={text}
          onChange={(event) => change(event.target.value)}
          onKeyDown={keyDown}
          onPaste={event=>{
            const files=Array.from(event.clipboardData.files);
            if(!files.length)for(const item of Array.from(event.clipboardData.items)){if(item.kind==="file"){const file=item.getAsFile();if(file)files.push(file);}}
            if(!files.length)return;
            event.preventDefault();addFiles(files);
            const pasted=event.clipboardData.getData("text/plain");
            if(pasted){const input=event.currentTarget;change(text.slice(0,input.selectionStart)+pasted+text.slice(input.selectionEnd));}
          }}
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
          <EmojiPicker choices={COMPOSER_CHOICES} label={t("emoji.action")} testId="chat-composer-emoji" disabled={disabled||uploading} finalFocus={inputRef}
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
          disabled={disabled || uploading || (!validation.ok&&!attachments.length) || !!problem}
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
