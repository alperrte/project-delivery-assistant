"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api/client";
import { useChat } from "../chat-provider";
import { formatListTime } from "../format";
import { GroupAvatar, PersonAvatar } from "./person-avatar";
import { cn } from "@/lib/utils";
export function ConversationList({onSelected}:{onSelected?:()=>void}) {
 const chat=useChat(), t=useTranslations("chat"),locale=useLocale();
 const [filter,setFilter]=useState<"all"|"direct"|"projects">("all");
 const rows=useMemo(()=>[...(chat.overview?.groups??[]),...(chat.overview?.directs??[])].filter(c=>filter==="all"||(filter==="direct"?c.type==="DIRECT":c.type==="PROJECT")).sort((a,b)=>(b.lastMessage?.createdAt??"").localeCompare(a.lastMessage?.createdAt??"")),[chat.overview,filter]);
 if(chat.overviewStatus==="error"||chat.membersStatus==="error") return <div role="alert" className="p-4"><p>{t("listFailed")}</p><Button onClick={()=>{chat.refetchOverview();chat.refetchMembers();}}>{t("retry")}</Button></div>;
 if(!chat.overview) return <div aria-busy="true" className="p-4"><Skeleton className="h-20"/></div>;
 return <nav aria-label={t("conversations")} className="min-h-0 flex-1 overflow-y-auto p-2">
 <div className="mb-2 flex flex-wrap gap-1" aria-label={t("categories.label")}>{(["all","direct","projects"] as const).map(f=><Button key={f} size="sm" variant={filter===f?"secondary":"ghost"} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{t(`categories.${f}`)}</Button>)}</div>
 <ul className="space-y-1" data-testid="chat-conversation-list">{rows.map(c=>{const group=c.type==="PROJECT",selected=chat.activeConversationId===c.id;return <li key={c.id}><button type="button" data-testid={group?"chat-conversation-group":"chat-conversation-direct"} data-conversation-id={c.id} data-peer-id={c.peer?.userId} aria-current={selected?"true":undefined} className={cn("flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring",selected&&"bg-accent")} onClick={()=>{if(group)chat.selectGroup(c.id);else if(c.peer)chat.selectPeer(c.peer.userId,c.id);onSelected?.();}}>
 {group?<GroupAvatar shape={c.logoShape} logoSrc={c.projectId&&c.logoVersion?apiUrl(`/projects/${c.projectId}/logo?v=${c.logoVersion}`):null} className="size-9"/>:c.peer?<PersonAvatar user={c.peer} className="size-9"/>:null}
 <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{group?c.projectName:c.peer?.nickname??"?"}</span><span className="block truncate text-xs text-muted-foreground">{c.lastMessage?(c.lastMessage.deleted?t("delete.deletedMessage"):c.lastMessage.preview):t("groupHint")}</span></span>
 {c.lastMessage&&<span className="text-[11px] text-muted-foreground">{formatListTime(c.lastMessage.createdAt,locale)}</span>}{c.unread>0&&<span aria-label={t("unreadCount",{count:c.unread})} className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{c.unread}</span>}
 </button></li>;})}</ul>
 {rows.length===0&&<p className="p-3 text-sm text-muted-foreground">{t("categories.empty")}</p>}
 {filter!=="projects"&&<div className="mt-3 border-t pt-2"><p className="p-2 text-xs text-muted-foreground">{t("categories.start")}</p>{chat.members?.filter(m=>!chat.overview?.directs.some(d=>d.peer?.userId===m.userId)).map(m=><button key={m.userId} data-testid="chat-conversation-direct" data-peer-id={m.userId} type="button" className="flex min-h-11 w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring" onClick={()=>{chat.selectPeer(m.userId,m.conversationId);onSelected?.();}}><PersonAvatar user={m} className="size-8"/>{m.nickname}</button>)}</div>}
 </nav>;
}
