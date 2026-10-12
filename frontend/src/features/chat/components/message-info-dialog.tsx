"use client";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/features/auth/hooks/use-session";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { chatApi } from "../api";
import { chatKeys } from "../cache";
import type { ChatMessage } from "../types";
import { PersonAvatar } from "./person-avatar";
export function MessageInfoDialog({message,open,onOpenChange}:{message:ChatMessage;open:boolean;onOpenChange:(value:boolean)=>void}) {
 const t=useTranslations("chat.info"),chat=useTranslations("chat"),locale=useLocale(),{data:user}=useSession();
 const query=useQuery({queryKey:chatKeys.info(user?.id??"",message.conversationId,message.id),queryFn:({signal})=>chatApi.info(message.conversationId,message.id,signal),enabled:open&&user?.id===message.sender.userId,refetchInterval:open?10000:false});
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent onKeyDown={event=>{if(event.key==="Escape")event.stopPropagation();}} className="max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-md"><DialogTitle>{t("title")}</DialogTitle>
 {query.isPending?<p role="status">{chat("loading")}</p>:query.isError?<div role="alert"><p>{t("failed")}</p><Button onClick={()=>void query.refetch()}>{chat("retry")}</Button></div>:(['read','unread'] as const).map(section=>{
  const rows=query.data.readers.filter(r=>section==='read'?r.readAt!==null:r.readAt===null);
  return <section key={section}><h3 className="mb-2 text-sm font-semibold">{t(section)} ({rows.length})</h3>{rows.length===0?<p className="text-sm text-muted-foreground">{t("empty")}</p>:<ul className="space-y-3">{rows.map(row=><li key={row.user.userId} className="flex items-center gap-3"><PersonAvatar user={row.user} className="size-9"/><div className="min-w-0"><p className="truncate text-sm">{row.user.nickname??"?"}</p><p className="text-xs text-muted-foreground">{row.readAt?<time dateTime={row.readAt}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.readAt))}</time>:t("notRead")}</p>{row.legacy&&row.readAt&&<p className="text-xs text-muted-foreground">{t("legacy")}</p>}</div></li>)}</ul>}</section>;
 })}
 </DialogContent></Dialog>;
}
