"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft,ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip,TooltipTrigger,TooltipContent } from "@/components/ui/tooltip";
import { useWorkspaceHistory } from "./use-workspace-history";

export function WorkspaceHistoryControls({enabled=true}:{enabled?:boolean}) {
  const t=useTranslations("workspace.history"),history=useWorkspaceHistory(enabled),description=useId();
  return <div role="group" aria-label={t("label")} data-testid="workspace-history" data-history-status={history.status} className="flex shrink-0 items-center gap-1">
    <Tooltip><TooltipTrigger render={<span className="inline-flex shrink-0" />}>
      <Button type="button" variant="ghost" size="icon-sm" className="max-sm:size-11" aria-label={t("back")} data-testid="workspace-back"
        aria-describedby={!history.canBack?`${description}-back`:undefined} disabled={!history.canBack} onClick={()=>history.back()}><ArrowLeft size={18} aria-hidden="true" /></Button>
    </TooltipTrigger><TooltipContent>{history.canBack?t("back"):t(`reasons.${history.backReason}`)}</TooltipContent></Tooltip>
    <Tooltip><TooltipTrigger render={<span className="inline-flex shrink-0" />}>
      <Button type="button" variant="ghost" size="icon-sm" className="max-sm:size-11" aria-label={t("forward")} data-testid="workspace-forward"
        aria-describedby={!history.canForward?`${description}-forward`:undefined} disabled={!history.canForward} onClick={()=>history.forward()}><ArrowRight size={18} aria-hidden="true" /></Button>
    </TooltipTrigger><TooltipContent>{history.canForward?t("forward"):t(`reasons.${history.forwardReason}`)}</TooltipContent></Tooltip>
    {!history.canBack&&<span id={`${description}-back`} className="sr-only">{t(`reasons.${history.backReason}`)}</span>}
    {!history.canForward&&<span id={`${description}-forward`} className="sr-only">{t(`reasons.${history.forwardReason}`)}</span>}
  </div>;
}
