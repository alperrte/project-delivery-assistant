"use client";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ChatMessage, ReactionCode } from "../types";
import { useRef, useState } from "react";
import { ReactionDetails } from "./reaction-details";

export function ReactionChips({ message,onReact,pending,disabled }: {message:ChatMessage;onReact:(code:ReactionCode,add:boolean)=>void;pending:(code:ReactionCode)=>boolean;disabled?:boolean}) {
  const t=useTranslations("chat");
  const [selected,setSelected]=useState<ReactionCode>();
  const anchor=useRef<HTMLButtonElement>(null);
  if(!message.reactions.length&&!selected)return null;
  return <div data-testid="chat-reactions" className="mt-1 flex max-w-full flex-wrap gap-1">
    {message.reactions.map(reaction=><button key={reaction.code} type="button" data-testid={`chat-reaction-${reaction.code}`} data-own-reaction={reaction.reactedByCurrentUser} aria-haspopup="dialog" aria-expanded={selected===reaction.code}
      aria-label={t("reactions.chip",{emoji:reaction.emoji,count:reaction.count})}
      className={cn("inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border px-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 max-sm:min-h-11",reaction.reactedByCurrentUser?"border-primary/30 bg-primary/10 text-foreground":"border-border bg-muted text-foreground")}
      onClick={event=>{anchor.current=event.currentTarget;setSelected(reaction.code);}}><span aria-hidden="true">{reaction.emoji}</span><span>{reaction.count}</span></button>)}
    {selected&&<ReactionDetails key={selected} message={message} initialCode={selected} anchor={anchor} onClose={()=>setSelected(undefined)} onReact={onReact} pending={pending} disabled={disabled}/>}
  </div>;
}
