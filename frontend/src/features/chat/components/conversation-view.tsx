"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { useChat, draftKey } from "../chat-provider";
import { useChatMessages } from "../hooks";
import { MessageComposer } from "./message-composer";
import { GroupAvatar, PersonAvatar } from "./person-avatar";
import { MessageList } from "./message-list";

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True while the tab is in the foreground; unread messages are only "read" when somebody can actually see them. */
function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeToVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

/** Name and avatar of the active conversation, for the headers of the panel and the compact window. */
export function ActiveConversationIdentity({ avatarClassName }: { avatarClassName?: string }) {
  const t = useTranslations("chat");
  const { active, activePeer, projectName, projectLogoSrc } = useChat();
  if (active?.kind === "direct") {
    return (
      <>
        {activePeer ? <PersonAvatar user={activePeer} className={avatarClassName} /> : <Skeleton className="size-8 rounded-full" />}
        <span className="min-w-0 truncate text-sm font-semibold" data-testid="chat-active-name">
          {activePeer?.nickname ?? "…"}
        </span>
      </>
    );
  }
  return (
    <>
      <GroupAvatar logoSrc={projectLogoSrc} className={avatarClassName} />
      <span className="min-w-0 truncate text-sm font-semibold" data-testid="chat-active-name">
        {projectName ?? t("groupName")}
      </span>
    </>
  );
}

/**
 * The active conversation: history, composer and connection state. The owner mounts it with a `key` per
 * conversation, so scrolling, read marking and the composer start fresh whenever the conversation changes, while
 * the loaded messages and the draft live on in the query cache and the provider.
 */
export function ConversationView({ autoFocus }: { autoFocus?: boolean }) {
  const t = useTranslations("chat");
  const te = useTranslations("errors");
  const chat = useChat();
  const { data: user } = useSession();
  const selfId = user?.id;
  const { projectId, activeConversationId: conversationId, active, overview, reportView, markRead } = chat;
  const query = useChatMessages(projectId, conversationId);
  const visible = useDocumentVisible();
  const [atBottom, setAtBottom] = useState(true);
  const markedRef = useRef<string | null>(null);

  const messages = query.messages;
  const last = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const unread =
    overview && conversationId
      ? conversationId === overview.group.id
        ? overview.group.unread
        : (overview.directs.find((direct) => direct.id === conversationId)?.unread ?? 0)
      : 0;
  const lastId = last?.id;
  const lastFromOther = last !== undefined && last.sender.userId !== selfId;

  // Tell the provider what is on screen: an incoming message is only "read" when the reader is at the bottom.
  useEffect(() => {
    reportView({ conversationId: conversationId ?? null, atBottom: atBottom && visible });
    return () => reportView({ conversationId: null, atBottom: false });
  }, [reportView, conversationId, atBottom, visible]);

  // Mark the conversation read once somebody can see its newest message (debounced, once per newest message).
  useEffect(() => {
    if (!conversationId || !atBottom || !visible || !lastId) return;
    if (unread === 0 && !lastFromOther) return;
    const marker = `${conversationId}:${lastId}`;
    if (unread === 0 && markedRef.current === marker) return;
    const timer = window.setTimeout(() => {
      markedRef.current = marker;
      markRead(conversationId);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [conversationId, atBottom, visible, lastId, lastFromOther, unread, markRead]);

  const opening = !conversationId;
  const key = active ? draftKey(active) : "none";

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="chat-conversation">
      {opening ? (
        <div className="flex-1 space-y-3 p-4" aria-busy="true" aria-label={t("openingDirect")}>
          <Skeleton className="h-10 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
        </div>
      ) : (
        <MessageList
          conversationId={conversationId}
          messages={messages}
          outbox={chat.outboxFor(conversationId)}
          selfId={selfId}
          showSenders={active?.kind === "group"}
          loading={query.isPending}
          error={query.isError && messages.length === 0}
          onRetryLoad={() => void query.refetch()}
          hasOlder={query.hasNextPage}
          loadingOlder={query.isFetchingNextPage}
          onLoadOlder={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onAtBottomChange={setAtBottom}
          onRetrySend={(clientId) => chat.retry(conversationId, clientId)}
          onDiscard={(clientId) => chat.discard(conversationId, clientId)}
          errorLabel={(errorKey) => te(errorKey)}
        />
      )}
      <MessageComposer
        key={key}
        draftKey={key}
        initialDraft={chat.getDraft(key)}
        onDraftChange={(text) => chat.setDraft(key, text)}
        onSend={(text) => {
          if (conversationId) chat.send(conversationId, text);
        }}
        disabled={opening || chat.sendBlocked}
        disabledReason={chat.sendBlocked ? t("disconnected") : undefined}
        autoFocus={autoFocus}
      />
    </div>
  );
}
