"use client";

import { useTranslations } from "next-intl";
import { ChatsCircle } from "@phosphor-icons/react";
import { navItemClass } from "@/components/layout/nav-item";
import { cn } from "@/lib/utils";
import { useChat } from "../chat-provider";
import { useChatOverview } from "../hooks";

/**
 * "Mesajlaşma" in the selected-project group of the sidebar. It is a button, not a link: it opens the chat panel over
 * the page. The selected project's chat opens in place on any workspace page. Its unread badge is kept live by
 * the selected context's socket, and refreshed on a timer while that connection is unavailable.
 */
export function ChatNavItem({
  projectId,
  slug,
  collapsed,
  onNavigate,
}: {
  projectId: string | undefined;
  slug: string;
  collapsed?: boolean;
  onNavigate: () => void;
}) {
  const t = useTranslations("chat");
  const chat = useChat();
  const live = chat.projectId !== undefined && chat.projectId === projectId && chat.connection === "connected";
  const { data: overview } = useChatOverview(projectId, { poll: !live });
  const unread = overview?.totalUnread ?? 0;
  const active = chat.mode === "full" && chat.projectId === projectId;
  const summary = unread > 0 ? t("nav.unread", { count: unread }) : undefined;

  function activate() {
    onNavigate();
    if (chat.contextSlug === slug) chat.open();
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={activate}
        title={t("nav.label")}
        aria-label={summary ? `${t("nav.label")}, ${summary}` : t("nav.label")}
        aria-pressed={active}
        data-testid="chat-nav-item"
        className={navItemClass(
          active,
          "flex w-full cursor-pointer items-center justify-center rounded-md py-2 hover:bg-muted hover:text-foreground",
        )}
      >
        <span className="relative">
          <ChatsCircle size={17} weight={active ? "fill" : "regular"} aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              data-testid="chat-nav-dot"
              className="absolute -top-1 -right-1 size-2 rounded-full bg-primary ring-2 ring-card"
            />
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={activate}
      aria-pressed={active}
      data-testid="chat-nav-item"
      className={navItemClass(
        active,
        cn("flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] hover:bg-muted hover:text-foreground"),
      )}
    >
      <ChatsCircle size={17} weight={active ? "fill" : "regular"} aria-hidden="true" />
      {t("nav.label")}
      {unread > 0 && (
        <>
          <span
            aria-hidden="true"
            data-testid="chat-nav-badge"
            className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] leading-none font-semibold text-primary-foreground tabular-nums"
          >
            {unread > 99 ? "99+" : unread}
          </span>
          <span className="sr-only">{summary}</span>
        </>
      )}
    </button>
  );
}
