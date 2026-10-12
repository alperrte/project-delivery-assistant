"use client";
/* eslint-disable @next/next/no-img-element -- Private cookie-authenticated media and local blob previews cannot use the image proxy. */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, DownloadSimple } from "@phosphor-icons/react";
import { apiUrl } from "@/lib/api/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ChatMessage } from "../types";

export function MessageAttachment({message}:{message:ChatMessage}) {
 const locale=useLocale(),t=useTranslations("chat.files"),[open,setOpen]=useState(false),file=message.attachment;
 if(!file)return null;
 const url=apiUrl(`/chat/conversations/${message.conversationId}/messages/${message.id}/attachment`);
 const image=file.contentType.startsWith("image/");
 return <div className="mb-1 max-w-full" data-testid="chat-message-attachment">
  {image?<button type="button" className="block rounded-md focus-visible:ring-3 focus-visible:ring-ring" aria-label={t("view")} onClick={()=>setOpen(true)}><img width={240} height={160} loading="lazy" src={`${url}?inline=true`} alt={file.filename} className="max-h-48 max-w-full rounded-md object-contain"/></button>:<div className="flex items-center gap-2"><FileText size={24} aria-hidden="true"/><span className="min-w-0 break-all text-sm">{file.filename}</span></div>}
  <a href={url} download={file.filename} className="mt-1 inline-flex min-h-11 items-center gap-1 rounded px-1 text-xs underline focus-visible:ring-3 focus-visible:ring-ring"><DownloadSimple size={16} aria-hidden="true"/>{t("download")} · {new Intl.NumberFormat(locale,{style:"unit",unit:"kilobyte",maximumFractionDigits:1}).format(file.size/1024)}</a>
  {image&&<Dialog open={open} onOpenChange={setOpen}><DialogContent onKeyDown={event=>{if(event.key==="Escape")event.stopPropagation();}} className="max-h-[90dvh] overflow-auto overscroll-contain sm:max-w-3xl"><DialogTitle className="break-all">{file.filename}</DialogTitle><img width={240} height={160} loading="lazy" src={`${url}?inline=true`} alt={file.filename} className="max-h-[70dvh] w-full object-contain"/></DialogContent></Dialog>}
 </div>;
}
