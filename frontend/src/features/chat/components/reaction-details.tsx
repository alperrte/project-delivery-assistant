"use client";
import { useState, useSyncExternalStore, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover } from "@base-ui/react/popover";
import { X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useChat } from "../chat-provider";
import { chatApi } from "../api";
import { chatKeys } from "../cache";
import { REACTION_CHOICES } from "../emoji-catalog";
import { EmojiPicker } from "./emoji-picker";
import { PersonAvatar } from "./person-avatar";
import type { ChatMessage, ReactionCode } from "../types";

function subscribe(listener: () => void) { const query = window.matchMedia("(min-width: 768px)"); query.addEventListener("change", listener); return () => query.removeEventListener("change", listener); }
export function ReactionDetails({ message, initialCode, anchor, onClose, onReact, pending, disabled }: {
  message: ChatMessage; initialCode: ReactionCode; anchor: RefObject<HTMLButtonElement | null>; onClose: () => void;
  onReact: (code: ReactionCode, add: boolean) => void; pending: (code: ReactionCode) => boolean; disabled?: boolean;
}) {
  const t = useTranslations("chat"), chat = useChat();
  const [code, setCode] = useState<ReactionCode | null>(initialCode), [page, setPage] = useState(0);
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 768px)").matches, () => false);
  const query = useQuery({ queryKey: [...chatKeys.reactionDetailsRoot(chat.accountId ?? "", message.conversationId), message.id, code, page],
    queryFn: ({ signal }) => chatApi.reactionDetails(message.conversationId, message.id, code, page, signal), enabled: !!chat.accountId && !message.deleted, refetchInterval: 10000 });
  const reactions = query.data?.reactions ?? message.reactions;
  const content = <>
    <div role="group" aria-label={t("reactions.details")} className="flex flex-wrap gap-1">
      <Button variant={code === null ? "secondary" : "ghost"} className="min-h-11" aria-pressed={code === null} onClick={() => { setCode(null); setPage(0); }}>{t("reactions.all")} ({reactions.reduce((sum, r) => sum + r.count, 0)})</Button>
      {reactions.map(r => <Button key={r.code} variant={code === r.code ? "secondary" : "ghost"} className="min-h-11" aria-label={t("reactions.chip", {emoji:r.emoji,count:r.count})} aria-pressed={code === r.code} onClick={() => { setCode(r.code); setPage(0); }}>{r.emoji} {r.count}</Button>)}
    </div>
    {query.isPending ? <p role="status" className="p-3">{t("loading")}</p> : query.isError ? <div role="alert" className="p-3"><p>{t("reactions.detailsFailed")}</p><Button onClick={() => void query.refetch()}>{t("retry")}</Button></div> : <>
      <p role="status" className="text-xs text-muted-foreground">{t("reactions.total", { count: query.data.total })}</p>
      <ul data-workspace-scroll="" className="max-h-[40dvh] space-y-1 overflow-y-auto overscroll-contain">
        {query.data.users.map(row => <li key={`${row.code}:${row.user.userId}`} className="flex min-h-12 items-center gap-2 py-1">
          <PersonAvatar user={row.user} className="size-8" /><span className="min-w-0 flex-1 break-words text-sm">{row.user.nickname ?? t("reactions.unknown")}{row.user.userId === chat.accountId && <span className="ml-1 text-xs text-muted-foreground">({t("reactions.you")})</span>}</span>
          <span aria-hidden="true">{reactions.find(r => r.code === row.code)?.emoji}</span>
          {row.user.userId === chat.accountId && <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("reactions.remove")} disabled={disabled || pending(row.code)} onClick={() => onReact(row.code, false)}><X aria-hidden="true" /></Button>}
        </li>)}
      </ul>
      {!query.data.users.length && <p className="p-3 text-sm text-muted-foreground">{t("reactions.empty")}</p>}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={page === 0 || query.isFetching} onClick={() => setPage(page - 1)}>{t("reactions.previous")}</Button>
        <Button variant="ghost" disabled={(page + 1) * query.data.size >= query.data.total || query.isFetching} onClick={() => setPage(page + 1)}>{t("reactions.next")}</Button>
      </div>
    </>}
    <EmojiPicker choices={REACTION_CHOICES} label={t("reactions.action")} testId="chat-details-react" disabled={disabled} onChoose={choice => { if (choice.code) onReact(choice.code, !reactions.some(r => r.code === choice.code && r.reactedByCurrentUser)); }} />
  </>;
  return desktop ? <Popover.Root open onOpenChange={value => { if (!value) onClose(); }}><Popover.Portal><Popover.Positioner anchor={anchor} side="top" sideOffset={8} className="z-50">
    <Popover.Popup finalFocus={anchor} data-workspace-scroll="" data-testid="chat-reaction-details" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
      className="max-h-(--available-height) w-[min(24rem,calc(100vw-2rem))] space-y-3 overflow-y-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg outline-none duration-100 motion-reduce:duration-0 data-open:animate-in data-open:fade-in-0">
      <div className="flex items-center justify-between"><Popover.Title className="text-sm font-semibold">{t("reactions.details")}</Popover.Title><Popover.Close render={<Button variant="ghost" size="icon" aria-label={t("emoji.close")} />}><X aria-hidden="true" /></Popover.Close></div>{content}
    </Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root> : <Dialog open onOpenChange={value => { if (!value) onClose(); }}><DialogContent data-testid="chat-reaction-details" finalFocus={anchor} onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }} className="max-h-[85dvh] gap-3 p-4"><DialogTitle>{t("reactions.details")}</DialogTitle>{content}</DialogContent></Dialog>;
}
