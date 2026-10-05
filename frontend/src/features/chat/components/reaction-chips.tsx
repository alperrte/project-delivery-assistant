"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ChatMessage, ReactionCode } from "../types";

export function ReactionChips({ message,onReact,pending,disabled }: {message:ChatMessage;onReact:(code:ReactionCode,add:boolean)=>void;pending:(code:ReactionCode)=>boolean;disabled?:boolean}) {
  const t=useTranslations("chat");
  if(!message.reactions.length)return null;
  return <div data-testid="chat-reactions" className="mt-1 flex max-w-full flex-wrap gap-1">
    {message.reactions.map(reaction=><button key={reaction.code} type="button" data-testid={`chat-reaction-${reaction.code}`} aria-pressed={reaction.reactedByCurrentUser}
      aria-label={t("reactions.chip",{emoji:reaction.emoji,count:reaction.count})} disabled={disabled||pending(reaction.code)}
      className={cn("inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 max-sm:min-h-11",reaction.reactedByCurrentUser?"border-primary/30 bg-primary/10 text-foreground":"border-border bg-muted text-foreground")}
      onClick={()=>onReact(reaction.code,!reaction.reactedByCurrentUser)}><span aria-hidden="true">{reaction.emoji}</span><span>{reaction.count}</span></button>)}
  </div>;
}
