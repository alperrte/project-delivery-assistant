"use client";
import { useTranslations } from "next-intl";
import { CornerUpLeft, SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MeetingMessage } from "../types";

/**
 * One message of the meeting chat: its bubble, the quote when it answers another message, the actions (reply, react) and the reaction
 * chips. The actions show on hover and keyboard focus, and always on touch screens; the chips are the way to add or take back your own
 * emoji with one tap.
 */
export function ChatMessage({ message, selfId, own, continued, highlighted, time, onReply, onOpenPicker, onToggle, onJump }: {
  message: MeetingMessage; selfId: string; own: boolean; /** Not the first message of its author's run (its time is read, not shown). */ continued: boolean;
  highlighted: boolean; time: string;
  onReply: (message: MeetingMessage) => void; onOpenPicker: (message: MeetingMessage, anchor: HTMLElement) => void;
  onToggle: (message: MeetingMessage, emoji: string) => void; onJump: (messageId: string) => void;
}) {
  const t = useTranslations("meetings");
  const reactions = message.reactions ?? [];
  const quote = message.replyTo, quoteName = quote ? (quote.participantId === selfId ? t("you") : quote.displayName) : "";
  return <div data-message-id={message.id} tabIndex={-1} data-highlighted={highlighted ? "" : undefined}
    className={cn("group/msg rounded-xl outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring", highlighted && "ring-2 ring-meeting")}>
    <div className="flex items-start gap-1">
      <div title={time} className={cn("w-fit max-w-full min-w-0 rounded-xl px-3 py-2 text-sm leading-6", own ? "bg-meeting-soft" : "bg-muted/60", message.mentionIds.includes(selfId) && "ring-1 ring-meeting")}>
        {message.replyToMessageId && (quote
          ? <button type="button" data-reply-quote={message.replyToMessageId} title={t("replyGoTo")} aria-label={t("replyQuoteLabel", { name: quoteName, preview: quote.preview })}
              onClick={() => onJump(message.replyToMessageId!)}
              className="mb-1.5 block w-full min-w-0 cursor-pointer rounded-md border-l-2 border-meeting bg-background/60 px-2 py-1 text-left text-xs outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block truncate font-semibold">{quoteName}</span>
              <span className="line-clamp-2 break-words text-muted-foreground">{quote.preview}</span>
            </button>
          : <span data-reply-missing className="mb-1.5 block rounded-md border-l-2 border-muted-foreground/40 px-2 py-1 text-xs italic text-muted-foreground">{t("replyUnavailable")}</span>)}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      <div role="group" aria-label={t("messageActions")}
        className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100 group-focus-within/msg:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <Button type="button" variant="ghost" size="icon-sm" data-message-action="reply" aria-label={t("replyAction")} title={t("replyAction")} className="[@media(pointer:coarse)]:size-11" onClick={() => onReply(message)}><CornerUpLeft size={15} aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon-sm" data-message-action="react" aria-label={t("reactAction")} title={t("reactAction")} className="[@media(pointer:coarse)]:size-11" onClick={event => onOpenPicker(message, event.currentTarget)}><SmilePlus size={15} aria-hidden="true" /></Button>
      </div>
    </div>
    {reactions.length > 0 && <div data-reactions className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map(reaction => {
        const names = reaction.reactors.map(r => r.displayName).filter(Boolean), more = reaction.count - reaction.reactors.length;
        const who = names.join(", ") + (more > 0 ? ` +${more}` : "");
        return <span key={reaction.emoji} className="group/chip relative">
          <button type="button" data-reaction={reaction.emoji} data-own={reaction.reactedByMe} aria-pressed={reaction.reactedByMe}
            aria-label={t(reaction.reactedByMe ? "reactionChipOwn" : "reactionChip", { emoji: reaction.emoji, count: reaction.count, names: who })}
            onClick={() => onToggle(message, reaction.emoji)}
            className={cn("inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border px-2 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11",
              reaction.reactedByMe ? "border-meeting bg-meeting-soft font-medium text-meeting-ink" : "bg-background")}>
            <span aria-hidden="true">{reaction.emoji}</span><span aria-hidden="true" className="tabular-nums">{reaction.count}</span>
          </button>
          {who && <span aria-hidden="true" data-reaction-people className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1 w-max max-w-56 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover/chip:visible group-focus-within/chip:visible">{who}</span>}
        </span>;
      })}
    </div>}
    {continued && <time dateTime={message.sentAt} className="sr-only">{time}</time>}
  </div>;
}
