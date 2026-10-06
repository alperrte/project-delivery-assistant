"use client";
import { useTranslations } from "next-intl";
import type { ChatReply } from "../types";

export function ReplyPreview({ reply }: { reply: ChatReply }) {
  const t = useTranslations("chat");
  const name = reply.sender.nickname ?? t("reply.senderUnknown");
  return <blockquote data-testid="chat-reply-quote" data-reply-id={reply.id} aria-label={t("reply.context", { name })}
    className="mb-1 min-w-0 rounded-md border-l-2 border-current bg-background/10 px-2 py-1 text-xs">
    <p className="truncate font-semibold">{name}</p>
    <p className="line-clamp-2 break-words whitespace-pre-wrap opacity-80">{reply.preview || t("reply.unavailable")}</p>
  </blockquote>;
}
