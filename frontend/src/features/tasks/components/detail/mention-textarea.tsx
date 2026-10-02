"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useProjectMembers } from "../../hooks";
import { activeMention, insertMention } from "../../mentions";
import type { PersonRef } from "../../types";

const MAX_SUGGESTIONS = 6;

type MentionTextareaProps = {
  projectId: string;
  value: string;
  onChange: (text: string) => void;
  /** Called with the person a suggestion resolved to, so the caller can encode `@nickname` as a token on save. */
  onPick: (person: PersonRef) => void;
  /** Ctrl or Cmd + Enter. */
  onSubmit?: () => void;
  id?: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
};

/**
 * A textarea that suggests project members while typing `@`. The list is a combobox listbox driven from the
 * keyboard (arrows, Enter or Tab to pick, Escape to dismiss); the text keeps `@nickname`, the caller encodes it.
 */
export function MentionTextarea({ projectId, value, onChange, onPick, onSubmit, id, label, placeholder, maxLength, rows = 3, autoFocus, disabled }: MentionTextareaProps) {
  const t = useTranslations("tasks.detail.activity.composer");
  const listId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const members = useProjectMembers(projectId);

  const mention = activeMention(value, caret);
  const needle = mention?.query.toLowerCase() ?? "";
  const suggestions = mention && dismissed !== mention.start
    ? (members.data ?? [])
        .filter((member) => member.nickname && member.nickname.toLowerCase().includes(needle))
        .sort((a, b) => Number(b.nickname!.toLowerCase().startsWith(needle)) - Number(a.nickname!.toLowerCase().startsWith(needle)))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const open = suggestions.length > 0;
  const active = Math.min(index, Math.max(suggestions.length - 1, 0));
  const optionId = (position: number) => `${listId}-${position}`;

  function sync() {
    const element = field.current;
    if (element) setCaret(element.selectionStart ?? element.value.length);
  }

  function pick(position: number) {
    const member = suggestions[position];
    if (!member || !mention || !member.nickname) return;
    const next = insertMention(value, caret, mention.start, member.nickname);
    onPick({ userId: member.userId, nickname: member.nickname });
    onChange(next.text);
    setCaret(next.caret);
    setIndex(0);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(next.caret, next.caret);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((active + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((active - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(active);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(mention?.start ?? null);
        return;
      }
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={field}
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(active) : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
          setIndex(0);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={sync}
        onClick={sync}
        onSelect={sync}
        className="resize-y"
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={t("suggestions")} className="absolute top-full right-0 left-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg ring-1 ring-foreground/5">
          {suggestions.map((member, position) => (
            <li
              key={member.userId}
              id={optionId(position)}
              role="option"
              aria-selected={position === active}
              // Keep the caret in the textarea while choosing with the pointer.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(position)}
              onMouseMove={() => setIndex(position)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm", position === active ? "bg-accent text-accent-foreground" : "text-foreground")}
            >
              <Avatar name={member.nickname ?? "?"} className="size-5 text-[9px] ring-0" />
              <span className="truncate">@{member.nickname}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
