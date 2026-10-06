"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowBendUpLeft, CaretDown, Smiley } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { ChatMessage, ReactionCode } from "../types";
import { REACTION_CHOICES } from "../emoji-catalog";
import { EmojiPicker } from "./emoji-picker";

export function MessageActions({ message, own, onReply, onReact, disabled }: {
  message:ChatMessage;own:boolean;onReply:(message:ChatMessage)=>void;onReact:(code:ReactionCode,add:boolean)=>void;disabled?:boolean;
}) {
  const t=useTranslations("chat");
  const [menuOpen,setMenuOpen]=useState(false),[pickerOpen,setPickerOpen]=useState(false);
  const [handoffActive,setHandoffActive]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null),intent=useRef<"reply"|"react"|null>(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;intent.current=null;};},[]);
  function handoff(open:boolean){
    if(open)return;
    const action=intent.current;intent.current=null;
    if(!mounted.current||!trigger.current?.isConnected)return;
    if(action==="reply")onReply(message);
    else if(action==="react")setPickerOpen(true);
  }
  const label=t("actions.open");
  return <div className={cn("absolute top-0 z-10 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100",
    own?"right-0":"left-0",(menuOpen||pickerOpen)&&"sm:opacity-100")}>
    <DropdownMenu open={menuOpen} onOpenChange={open=>{if(open){setHandoffActive(false);setPickerOpen(false);}setMenuOpen(open);}} onOpenChangeComplete={handoff} modal={false}>
      <Tooltip><TooltipTrigger render={<DropdownMenuTrigger render={<Button ref={trigger} type="button" variant="ghost" size="icon-sm" data-testid="chat-message-actions"
        aria-label={label} className={cn("size-7 max-sm:size-11",own?"text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground":"text-foreground hover:bg-foreground/10")} />} />}>
        <CaretDown size={14} aria-hidden="true" />
      </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
      <DropdownMenuContent align={own?"end":"start"} className="w-auto min-w-48 max-w-[calc(100vw-1.5rem)]"
        aria-label={t("actions.label")}
        finalFocus={handoffActive?false:true} onKeyDown={event=>{if(event.key==="Escape")event.stopPropagation();}}>
        <DropdownMenuItem data-testid="chat-message-reply" onClick={()=>{intent.current="reply";setHandoffActive(true);setMenuOpen(false);}}>
          <ArrowBendUpLeft size={16} aria-hidden="true" />{t("reply.action")}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="chat-message-react" disabled={disabled} onClick={()=>{intent.current="react";setHandoffActive(true);setMenuOpen(false);}}>
          <Smiley size={16} aria-hidden="true" />{t("reactions.action")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <EmojiPicker choices={REACTION_CHOICES} label={t("reactions.action")} testId="chat-message-react" disabled={disabled}
      open={pickerOpen} onOpenChange={setPickerOpen} anchorRef={trigger} showTrigger={false} finalFocus={trigger}
      onChoose={choice=>{if(choice.code)onReact(choice.code,!message.reactions.some(reaction=>reaction.code===choice.code&&reaction.reactedByCurrentUser));}} />
  </div>;
}
