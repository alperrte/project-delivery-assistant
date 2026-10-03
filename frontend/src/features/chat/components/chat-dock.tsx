"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowsOut, Minus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChat, draftKey } from "../chat-provider";
import { ActiveConversationIdentity, ConversationView } from "./conversation-view";
import { GroupAvatar, PersonAvatar } from "./person-avatar";

/**
 * Where the dock sits: the bottom-right corner. Pages with a sticky save bar mark it `data-sticky-actions`, and the
 * dock then lifts above that bar so it never covers the save button. z-30 keeps it under the navbar (z-40) and
 * dialogs (z-50). On a phone it spans the width.
 */
const DOCK_POSITION =
  "fixed right-4 bottom-0 z-30 max-sm:inset-x-3 max-sm:right-3 [body:has([data-sticky-actions])_&]:bottom-[4.75rem]";

/** The title bar: the active conversation, the unread total, expand (to the compact window) and close. */
function Bar() {
  const t = useTranslations("chat");
  const chat = useChat();
  const expandRef = useRef<HTMLButtonElement>(null);
  const unread = chat.overview?.totalUnread ?? 0;

  useEffect(() => {
    // The panel just shrank into this bar: keep keyboard focus on something that still exists.
    expandRef.current?.focus();
  }, []);

  return (
    <div
      role="region"
      aria-label={t("dock.label")}
      data-testid="chat-bar"
      className={cn(DOCK_POSITION, "flex items-center rounded-t-xl border border-b-0 bg-card shadow-lg sm:w-72")}
    >
      <button
        ref={expandRef}
        type="button"
        onClick={chat.expandCompact}
        data-testid="chat-bar-expand"
        aria-label={unread > 0 ? `${t("dock.open")}, ${t("unreadCount", { count: unread })}` : t("dock.open")}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-tl-xl px-3 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {/* The face of the active conversation: the person's photo or initials, or the project's logo for the group. */}
        {chat.active?.kind === "direct" && chat.activePeer ? (
          <PersonAvatar user={chat.activePeer} className="size-6 text-[10px] ring-0" />
        ) : (
          <GroupAvatar logoSrc={chat.projectLogoSrc} className="size-6 ring-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" data-testid="chat-bar-title">
          {chat.active?.kind === "direct" ? (chat.activePeer?.nickname ?? t("title")) : (chat.projectName ?? t("groupName"))}
        </span>
        {unread > 0 && (
          <span
            aria-hidden="true"
            data-testid="chat-bar-unread"
            className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] leading-none font-semibold text-primary-foreground tabular-nums"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <Button variant="ghost" size="icon-sm" className="rounded-tr-xl" aria-label={t("panel.close")} data-testid="chat-close" onClick={chat.close}>
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

/** The compact window: the active conversation's history and composer, small enough to keep working next to it. */
function Compact() {
  const t = useTranslations("chat");
  const chat = useChat();
  const windowRef = useRef<HTMLDivElement>(null);

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      chat.minimize();
    }
  }

  const conversationKey = chat.active ? `${draftKey(chat.active)}:${chat.activeConversationId ?? ""}` : "none";

  return (
    <section
      ref={windowRef}
      aria-label={t("dock.label")}
      data-testid="chat-compact"
      onKeyDown={keyDown}
      className={cn(
        DOCK_POSITION,
        "flex h-[460px] max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-t-xl border border-b-0 bg-card shadow-xl sm:w-[360px] max-sm:h-[70dvh]",
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <ActiveConversationIdentity avatarClassName="size-8" />
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={t("panel.minimize")} data-testid="chat-minimize" onClick={chat.minimize}>
            <Minus size={16} aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("panel.fullscreen")} data-testid="chat-fullscreen" onClick={chat.expandFull}>
            <ArrowsOut size={16} aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("panel.close")} data-testid="chat-close" onClick={chat.close}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
      </header>
      <ConversationView key={conversationKey} autoFocus />
    </section>
  );
}

/** The two small states of the chat, `bar` and `compact`; both live in the bottom-right corner. */
export function ChatDock() {
  const { mode } = useChat();
  return mode === "compact" ? <Compact /> : <Bar />;
}
