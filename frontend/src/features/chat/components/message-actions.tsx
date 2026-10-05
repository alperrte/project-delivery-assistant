"use client";
import { useTranslations } from "next-intl";
import { ArrowBendUpLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatMessage, ReactionCode } from "../types";
import { REACTION_CHOICES } from "../emoji-catalog";
import { EmojiPicker } from "./emoji-picker";

export function MessageActions({ message, onReply, onReact, disabled }: { message: ChatMessage; onReply: (message: ChatMessage) => void;onReact:(code:ReactionCode,add:boolean)=>void;disabled?:boolean }) {
  const t = useTranslations("chat");
  return <div className="flex shrink-0 gap-1 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100">
    <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" data-testid="chat-message-reply"
      aria-label={t("reply.action")} className="h-7 w-7 max-sm:h-11 max-sm:w-11" onClick={() => onReply(message)} />}>
      <ArrowBendUpLeft size={16} aria-hidden="true" />
    </TooltipTrigger><TooltipContent>{t("reply.action")}</TooltipContent></Tooltip>
    <EmojiPicker choices={REACTION_CHOICES} label={t("reactions.action")} testId="chat-message-react" disabled={disabled}
      onChoose={choice=>{if(choice.code)onReact(choice.code,!message.reactions.some(reaction=>reaction.code===choice.code&&reaction.reactedByCurrentUser));}} />
  </div>;
}
