"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useChat } from "../chat-provider";
import { formatListTime } from "../format";
import type { ChatLastMessage } from "../types";
import { GroupAvatar, PersonAvatar } from "./person-avatar";

type Row = {
  key: string;
  userId: string;
  nickname: string | null;
  profilePhotoVersion: number | null;
  conversationId: string | null;
  lastMessage: ChatLastMessage | null;
  unread: number;
};

function UnreadPill({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className="ml-auto min-w-5 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] leading-none font-semibold text-primary-foreground tabular-nums"
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

/**
 * "Project group" first, then every other member of the project. People who already have a direct conversation show
 * its last message and unread count; everybody else is selectable and the conversation is created on first use.
 */
export function ConversationList({ onSelected }: { onSelected?: () => void }) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const chat = useChat();
  const { overview, members, overviewStatus, membersStatus, active } = chat;

  const rows = useMemo<Row[]>(() => {
    if (!members) return [];
    const directs = new Map((overview?.directs ?? []).map((direct) => [direct.peer?.userId, direct]));
    return members
      .map((member) => {
        const direct = directs.get(member.userId);
        return {
          key: member.userId,
          userId: member.userId,
          nickname: member.nickname,
          profilePhotoVersion: member.profilePhotoVersion,
          conversationId: member.conversationId ?? direct?.id ?? null,
          lastMessage: direct?.lastMessage ?? null,
          unread: direct?.unread ?? 0,
        };
      })
      .sort((a, b) => {
        const byActivity = (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? "");
        return byActivity !== 0 ? byActivity : (a.nickname ?? "").localeCompare(b.nickname ?? "", locale);
      });
  }, [members, overview, locale]);

  if (overviewStatus === "error" || membersStatus === "error") {
    return (
      <div role="alert" className="space-y-3 p-4 text-sm">
        <p className="text-muted-foreground">{t("listFailed")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            chat.refetchOverview();
            chat.refetchMembers();
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!overview || !members) {
    return (
      <div className="space-y-3 p-3" aria-busy="true" aria-label={t("listLoading")}>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const groupActive = active?.kind === "group";
  const group = overview.group;
  const rowClass = (selected: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
      selected && "bg-accent",
    );

  return (
    <nav aria-label={t("conversations")} className="min-h-0 flex-1 overflow-y-auto p-2">
      <ul className="space-y-0.5" data-testid="chat-conversation-list">
        <li>
          <button
            type="button"
            data-testid="chat-conversation-group"
            aria-current={groupActive ? "true" : undefined}
            onClick={() => {
              chat.selectGroup();
              onSelected?.();
            }}
            className={rowClass(groupActive)}
          >
            <GroupAvatar logoSrc={chat.projectLogoSrc} className="size-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{chat.projectName ?? t("groupName")}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {group.lastMessage?.preview ?? t("groupHint")}
              </span>
            </span>
            {group.lastMessage && (
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {formatListTime(group.lastMessage.createdAt, locale)}
              </span>
            )}
            <UnreadPill count={group.unread} label={t("unreadCount", { count: group.unread })} />
          </button>
        </li>

        {rows.map((row) => {
          const selected = active?.kind === "direct" && active.peerId === row.userId;
          return (
            <li key={row.key}>
              <button
                type="button"
                data-testid="chat-conversation-direct"
                data-peer-id={row.userId}
                aria-current={selected ? "true" : undefined}
                onClick={() => {
                  chat.selectPeer(row.userId, row.conversationId);
                  onSelected?.();
                }}
                className={rowClass(selected)}
              >
                <PersonAvatar user={row} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.nickname ?? "?"}</span>
                  {row.lastMessage && (
                    <span className="block truncate text-xs text-muted-foreground">{row.lastMessage.preview}</span>
                  )}
                </span>
                {row.lastMessage && (
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatListTime(row.lastMessage.createdAt, locale)}
                  </span>
                )}
                <UnreadPill count={row.unread} label={t("unreadCount", { count: row.unread })} />
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">{t("noMembers")}</p>}
    </nav>
  );
}
