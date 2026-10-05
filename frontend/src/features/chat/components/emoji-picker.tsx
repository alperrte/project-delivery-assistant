"use client";
import { useState, type RefObject } from "react";
import { Popover } from "@base-ui/react/popover";
import { Smiley, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { EmojiChoice } from "../emoji-catalog";

export function EmojiPicker({ choices, label, testId, onChoose, disabled, finalFocus }: {
  choices: EmojiChoice[];label:string;testId:string;onChoose:(choice:EmojiChoice)=>void;disabled?:boolean;finalFocus?:RefObject<HTMLElement|null>;
}) {
  const t=useTranslations("chat");const [open,setOpen]=useState(false);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger render={<Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={label}
      data-testid={testId} className="max-sm:size-11" />}><Smiley size={18} aria-hidden="true" /></Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="top" align="end" sideOffset={8} className="z-50">
      <Popover.Popup finalFocus={finalFocus} data-testid={`${testId}-popup`} aria-label={label}
        onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false);}}}
        className="max-h-(--available-height) w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0">
        <div className="mb-1 flex items-center justify-between gap-2 px-1 text-xs font-medium">
          <span>{label}</span><Popover.Close render={<Button type="button" variant="ghost" size="icon-sm" className="max-sm:size-11" aria-label={t("emoji.close")} />}><X size={14} aria-hidden="true" /></Popover.Close>
        </div>
        <div role="group" aria-label={label} className="grid grid-cols-6 gap-0.5">
          {choices.map(choice=><button key={choice.key} type="button" disabled={disabled} data-testid={`emoji-${choice.key}`} aria-label={t(`emoji.names.${choice.key}`)}
            className="grid min-h-11 min-w-0 place-items-center rounded-md text-xl outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            onClick={()=>{onChoose(choice);setOpen(false);}}><span aria-hidden="true">{choice.emoji}</span></button>)}
        </div>
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
