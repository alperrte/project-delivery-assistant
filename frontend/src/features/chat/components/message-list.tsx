"use client";

import { MessageAttachment } from "./message-attachment";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, Check, Checks, Prohibit } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { dayKey, formatClock, formatDayLabel } from "../format";
import type { ChatMessage, ChatReceipt, PendingMessage, ReactionCode } from "../types";
import { ReactionChips } from "./reaction-chips";
import { PersonAvatar } from "./person-avatar";
import { MessageActions } from "./message-actions";
import { ReplyPreview } from "./reply-preview";

/** Within this distance of the end the list counts as "at the bottom" (and follows new messages). */
const BOTTOM_SLACK_PX = 48;

type Props = {
  jump?: { id: string; sequence: number };
  browsingHistory?: boolean;
  conversationId: string;
  messages: ChatMessage[];
  outbox: PendingMessage[];
  selfId: string | undefined;
  /** In the project group each message shows who wrote it; in a direct conversation that is obvious. */
  showSenders: boolean;
  loading: boolean;
  error: boolean;
  onRetryLoad: () => void;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  /** Whether the user is at the bottom, so the owner can mark the conversation read. */
  onAtBottomChange: (atBottom: boolean) => void;
  onRetrySend: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  errorLabel: (key: string) => string;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: string, code: ReactionCode, add: boolean) => void;
  reactionPending: (messageId: string, code: ReactionCode) => boolean;
  reactionsDisabled: boolean;
  /** Deletes an own message for everybody (the dialog reports failures itself). */
  onDelete: (messageId: string) => Promise<void>;
  /** The other members' read markers, for the "seen" line. */
  receipts: ChatReceipt[];
};

/**
 * The history of one conversation, oldest at the top. It follows new messages only while the reader is already at the
 * bottom (otherwise a "New messages" button appears), keeps the reading position when older messages are loaded above,
 * and renders every message as plain text: nothing is ever interpreted as markup.
 */
export function MessageList({
  jump,
  browsingHistory,
  conversationId,
  messages,
  outbox,
  selfId,
  showSenders,
  loading,
  error,
  onRetryLoad,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onAtBottomChange,
  onRetrySend,
  onDiscard,
  errorLabel,
  onReply,
  onReact,
  reactionPending,
  reactionsDisabled,
  onDelete,
  receipts,
}: Props) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const initializedRef = useRef(false);
  const previous = useRef<{ firstId?: string; lastId?: string; height: number; outbox: number }>({ height: 0, outbox: 0 });
  const [atBottom, setAtBottom] = useState(true);
  const [highlight, setHighlight] = useState<string>();
  const lastJump = useRef<number>(-1);
  // The id of the newest message the reader has seen: anything newer while they are scrolled up is "new".
  const [seenLastId, setSeenLastId] = useState<string | undefined>(undefined);
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : undefined;
  const lastIdRef = useRef(lastId);
  const onLoadOlderRef = useRef(onLoadOlder);
  const onAtBottomChangeRef = useRef(onAtBottomChange);
  useEffect(() => {
    lastIdRef.current = lastId;
    onLoadOlderRef.current = onLoadOlder;
    onAtBottomChangeRef.current = onAtBottomChange;
  });

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const nowAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK_PX;
    const wasAtBottom = stickRef.current;
    stickRef.current = nowAtBottom;
    // Reaching the bottom, or just leaving it, means everything up to the newest message has been seen.
    if (nowAtBottom || wasAtBottom) setSeenLastId(lastIdRef.current);
    if (nowAtBottom !== atBottom) setAtBottom(nowAtBottom);
    onAtBottomChangeRef.current(nowAtBottom);
  }

  // Scroll position: jump to the end on first load, keep the place when older messages arrive on top, and follow
  // new ones only when the reader is at the end (or wrote them).
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const before = previous.current;
    const firstId = messages.length > 0 ? messages[0].id : undefined;
    const newest = messages.length > 0 ? messages[messages.length - 1] : undefined;
    const outboxGrew = outbox.length > before.outbox;
    if (!initializedRef.current) {
      if (messages.length > 0 || !loading) {
        el.scrollTop = el.scrollHeight;
        initializedRef.current = true;
      }
    } else if (before.firstId && firstId !== before.firstId && before.lastId === lastId) {
      el.scrollTop += el.scrollHeight - before.height;
    } else if (lastId !== before.lastId || outboxGrew) {
      if (!browsingHistory && (stickRef.current || outboxGrew || newest?.sender.userId === selfId)) {
        el.scrollTop = el.scrollHeight;
      }
    } else if (stickRef.current && el.scrollHeight !== before.height) {
      // Metadata can add a chip row without adding a message; keep a bottom reader anchored.
      el.scrollTop = el.scrollHeight;
    }
    previous.current = { firstId, lastId, height: el.scrollHeight, outbox: outbox.length };
  }, [messages, outbox, lastId, loading, selfId, browsingHistory]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !jump || lastJump.current === jump.sequence) return;
    const row = [...scroller.querySelectorAll<HTMLElement>("[data-message-id]")].find(element => element.dataset.messageId === jump.id);
    if (!row) return;
    lastJump.current = jump.sequence;
    stickRef.current = false;
    const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (scroller.clientHeight - row.clientHeight) / 2;
    scroller.scrollTo({ top, behavior: "instant" });
    if ((scroller.closest('[data-testid="chat-conversation"]')?.clientWidth ?? 0) < 700) row.focus({ preventScroll: true });
    setHighlight(jump.id);
    const bottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= BOTTOM_SLACK_PX;
    stickRef.current = bottom;
    setAtBottom(bottom);
    onAtBottomChangeRef.current(bottom);
  }, [jump, messages, loading]);
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(undefined), 2200);
    return () => clearTimeout(timer);
  }, [highlight, jump?.sequence]);

  // Older messages load when the top of the list comes into view (never before the first jump to the end).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scroller = scrollerRef.current;
    if (!sentinel || !scroller || !hasOlder) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && initializedRef.current) onLoadOlderRef.current();
      },
      { root: scroller, rootMargin: "120px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasOlder, conversationId, loadingOlder]);

  function scrollToEnd() {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-3 overflow-hidden p-4" aria-busy="true" aria-label={t("loading")}>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className={cn("h-10 w-2/3 rounded-2xl", index % 2 === 1 && "ml-auto")} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
        <p className="text-muted-foreground">{t("loadFailed")}</p>
        <Button variant="outline" size="sm" onClick={onRetryLoad}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const labels = { today: t("today"), yesterday: t("yesterday") };
  const showNewMessages = !browsingHistory && !atBottom && lastId !== undefined && lastId !== seenLastId;
  const empty = messages.length === 0 && outbox.length === 0;
  // "Seen" is shown under the newest own message only (like messengers do), not under every one.
  const lastOwnId = [...messages].reverse().find((message) => message.sender.userId === selfId && !message.deleted)?.id;
  const seenBy = (message: ChatMessage) =>
    receipts.filter((receipt) => receipt.messageId ? receipt.messageId===message.id : message.deliveryStatus === undefined && Date.parse(receipt.readAt) >= Date.parse(message.createdAt)).length;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={t("messagesLabel")}
        data-testid="chat-messages"
        data-workspace-scroll=""
        tabIndex={0}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4 outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
      >
        {hasOlder && (
          <div ref={sentinelRef} className="py-2 text-center text-xs text-muted-foreground" aria-hidden={!loadingOlder}>
            {loadingOlder ? t("loadingOlder") : ""}
          </div>
        )}
        {empty && <p className="py-10 text-center text-sm text-muted-foreground">{t("noMessages")}</p>}
        {messages.map((message, index) => {
          const own = message.sender.userId === selfId;
          const previousMessage = index > 0 ? messages[index - 1] : undefined;
          const newDay = !previousMessage || dayKey(previousMessage.createdAt) !== dayKey(message.createdAt);
          const newRun = newDay || previousMessage?.sender.userId !== message.sender.userId;
          return (
            <Fragment key={message.id}>
              {newDay && (
                <div className="flex justify-center py-2" role="separator">
                  <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {formatDayLabel(message.createdAt, locale, labels)}
                  </span>
                </div>
              )}
              <div
                data-testid="chat-message"
                data-own={own ? "true" : "false"}
                data-message-id={message.id}
                tabIndex={-1}
                data-search-highlight={highlight === message.id ? "true" : undefined}
                className={cn("group/message flex items-start gap-2 rounded-lg transition-colors duration-500", own ? "justify-end" : "justify-start", newRun && "pt-2", highlight === message.id && "bg-primary/15 ring-2 ring-primary/40")}
              >
                {/* The avatar is pinned to the top of the row: reactions and the time sit below the bubble and must not move it. */}
                {!own && showSenders && (
                  <span className="w-7 shrink-0">
                    {newRun && <PersonAvatar user={message.sender} className="size-7 text-[10px]" />}
                  </span>
                )}
                <div className={cn("flex max-w-[min(82%,38rem)] min-w-0 flex-col", own ? "items-end" : "items-start")}>
                  {!own && showSenders && newRun && (
                    <span className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
                      {message.sender.nickname ?? "?"}
                    </span>
                  )}
                  {/* The actions button sits beside the bubble (not inside its padding), so the bubble keeps equal left and right padding. */}
                  {message.deleted ? (
                    <div
                      data-testid="chat-message-deleted"
                      className="flex min-w-0 items-center gap-1.5 rounded-2xl border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground italic"
                    >
                      <Prohibit size={14} aria-hidden="true" className="shrink-0" />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{t("delete.deletedMessage")}</span>
                    </div>
                  ) : (
                    <>
                      <div className={cn("flex max-w-full min-w-0 items-start gap-1", own && "flex-row-reverse")}>
                        <div
                          data-testid="chat-message-bubble"
                          // Double click (double tap on touch screens) replies; the menu stays the keyboard route.
                          onDoubleClick={() => {
                            if (reactionsDisabled) return;
                            window.getSelection()?.removeAllRanges();
                            onReply(message);
                          }}
                          className={cn(
                            "min-w-0 rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap [overflow-wrap:anywhere] touch-manipulation",
                            own ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground",
                          )}
                        >
                          {message.replyTo && <ReplyPreview reply={message.replyTo} />}
                          {message.attachment&&<MessageAttachment message={message}/>}
                          <span data-testid="chat-message-text">{message.content}</span>
                        </div>
                        <MessageActions own={own} message={message} onReply={onReply} onReact={(code,add)=>onReact(message.id,code,add)}
                          onDelete={own ? () => onDelete(message.id) : undefined} disabled={reactionsDisabled} />
                      </div>
                      <ReactionChips message={message} onReact={(code,add)=>onReact(message.id,code,add)} pending={code=>reactionPending(message.id,code)} disabled={reactionsDisabled} />
                    </>
                  )}
                  <div className="mt-0.5 flex items-center gap-1">
                    <time dateTime={message.createdAt} className="px-1 text-[10px] text-muted-foreground tabular-nums">
                      {formatClock(message.createdAt, locale)}
                    </time>
                    {own && !message.deleted && (() => {
                      const isRead = message.deliveryStatus === undefined ? seenBy(message) > 0 : message.deliveryStatus === "READ";
                      const isDelivered = !isRead && message.deliveryStatus === "DELIVERED";
                      return (
                        <span
                          data-testid="chat-message-status"
                          title={isRead ? t("status.read") : isDelivered ? t("status.delivered") : t("status.sent")}
                          className="inline-flex items-center"
                        >
                          {isRead ? (
                            <span data-testid="chat-message-seen" className="inline-flex items-center text-sky-500 dark:text-sky-400">
                              <Checks size={13} weight="bold" aria-label={t("status.read")} />
                            </span>
                          ) : isDelivered ? (
                            <span className="inline-flex items-center text-muted-foreground">
                              <Checks size={13} weight="regular" aria-label={t("status.delivered")} />
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-muted-foreground">
                              <Check size={13} weight="bold" aria-label={t("status.sent")} />
                            </span>
                          )}
                        </span>
                      );
                    })()}
                    {own && message.id === lastOwnId && seenBy(message) > 0 && showSenders && (
                      <span className="text-[10px] text-muted-foreground">
                        {t("seen.count", { count: seenBy(message) })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
        {outbox.map((pending) => (
          <div key={pending.clientId} data-testid="chat-pending" data-status={pending.status} className="flex justify-end pt-2">
            <div className="flex max-w-[min(82%,38rem)] min-w-0 flex-col items-end">
              <div
                className={cn(
                  "rounded-2xl rounded-br-sm px-3 py-1.5 text-sm break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
                  pending.status === "failed"
                    ? "border border-destructive/50 bg-destructive/10 text-foreground"
                    : "bg-primary/60 text-primary-foreground",
                )}
              >
                {pending.replyTo && <ReplyPreview reply={pending.replyTo} />}
                {pending.content}
              </div>
              {pending.status === "sending" ? (
                <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{t("sending")}</span>
              ) : (
                <div role="alert" className="mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 px-1 text-[11px]">
                  <span className="text-destructive">
                    {t("sendFailed")}
                    {pending.errorKey ? ` · ${errorLabel(pending.errorKey)}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRetrySend(pending.clientId)}
                    className="font-medium underline underline-offset-2 hover:text-foreground"
                  >
                    {t("retrySend")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiscard(pending.clientId)}
                    className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {t("discard")}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {showNewMessages && (
        <Button
          type="button"
          size="sm"
          onClick={scrollToEnd}
          data-testid="chat-new-messages"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 gap-1 rounded-full shadow-md"
        >
          <ArrowDown size={14} weight="bold" aria-hidden="true" />
          {t("newMessages")}
        </Button>
      )}
    </div>
  );
}
