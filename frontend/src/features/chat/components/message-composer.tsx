"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { PaperPlaneRight, X } from "@phosphor-icons/react";
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
  onSend: (text: string) => void;
  /** Nothing can be sent right now (no conversation yet, or the connection is down). */
  disabled: boolean;
  disabledReason?: string;
  autoFocus?: boolean;
  reply?: ChatReply | null;
  onCancelReply?: () => void;
};

/**
 * The message box: Enter sends, Shift+Enter starts a new line, the counter mirrors the 2000 character limit. The
 * checks here only save a round trip, the server validates again.
 */
export function MessageComposer({ draftKey, initialDraft, onDraftChange, onSend, disabled, disabledReason, autoFocus, reply, onCancelReply }: Props) {
  const t = useTranslations("chat");
  const [text, setText] = useState(initialDraft);
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
  }

  function submit() {
    if (disabled || !validation.ok) return;
    onSend(text);
    setText("");
    onDraftChange("");
    inputRef.current?.focus();
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
      <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
        <Textarea
          ref={inputRef}
          value={text}
          onChange={(event) => change(event.target.value)}
          onKeyDown={keyDown}
          disabled={disabled}
          rows={1}
          aria-label={t("composerLabel")}
          aria-describedby={[hintId, disabledReason ? statusId : null].filter(Boolean).join(" ")}
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
          disabled={disabled || !validation.ok}
          aria-label={t("send")}
          data-testid="chat-send"
          className="shrink-0"
        >
          <PaperPlaneRight weight="fill" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span id={hintId} className="truncate">
          {problemText ? <span role="alert" className="text-destructive">{problemText}</span> : t("hint")}
        </span>
        <span className={cn("shrink-0 tabular-nums", overLimit && "font-semibold text-destructive")} aria-hidden="true">
          {t("counter", { count: length, max: MESSAGE_MAX_LENGTH })}
        </span>
      </div>
    </form>
  );
}
