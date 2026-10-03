"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { PaperPlaneRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MESSAGE_MAX_LENGTH, messageLength, normalizeMessage, validateMessage } from "../limits";

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
};

/**
 * The message box: Enter sends, Shift+Enter starts a new line, the counter mirrors the 2000 character limit. The
 * checks here only save a round trip, the server validates again.
 */
export function MessageComposer({ draftKey, initialDraft, onDraftChange, onSend, disabled, disabledReason, autoFocus }: Props) {
  const t = useTranslations("chat");
  const [text, setText] = useState(initialDraft);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();
  const statusId = useId();

  useEffect(() => {
    // Focus the box on desktop widths; on a phone the keyboard would cover the history the user just opened.
    if (autoFocus && window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
  }, [autoFocus, draftKey]);

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
    >
      {disabledReason && (
        <p id={statusId} role="status" data-testid="chat-disabled-reason" className="mb-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          {disabledReason}
        </p>
      )}
      <div className="flex items-end gap-2">
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
          className="max-h-32 min-h-10 resize-none py-2"
        />
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
