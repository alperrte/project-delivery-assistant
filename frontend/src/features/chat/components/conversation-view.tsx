"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { useChat, draftKey } from "../chat-provider";
import { useChatMessages, useChatReceipts } from "../hooks";
import { MessageComposer } from "./message-composer";
import { GroupAvatar, PersonAvatar } from "./person-avatar";
import { MessageList } from "./message-list";
import { TypingIndicator } from "./typing-indicator";
import type { ChatMessage, ChatReceipt, ChatReply } from "../types";
import { previewOf } from "../limits";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { chatApi } from "../api";
import { appendMessages, chatKeys } from "../cache";
import { errorKey } from "@/lib/api/error-message";

const NO_RECEIPTS: ChatReceipt[] = [];

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
  const { active, activePeer, projectName, projectLogoSrc, projectLogoShape } = useChat();
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
      <GroupAvatar shape={projectLogoShape} logoSrc={projectLogoSrc} className={avatarClassName} />
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
  const { accountId, activeConversationId: conversationId, active, reportView, markRead, notifyTyping } = chat;
  const query = useChatMessages(accountId, conversationId);
  const receipts = useChatReceipts(accountId, conversationId);
  const key = active ? draftKey(active) : "none";
  const [reply, setReply] = useState<ChatReply | null>(() => chat.getReply(key));
  function chooseReply(message: ChatMessage) {
    if (message.conversationId !== conversationId) return;
    const quote = { id: message.id, sender: { ...message.sender }, preview: previewOf(message.content || message.attachment?.filename || "") };
    setReply(quote); chat.setReply(key, quote);
  }
  function cancelReply() { setReply(null); chat.setReply(key, null); }
  const visible = useDocumentVisible();
  const [atBottom, setAtBottom] = useState(true);
  const confirmedReads=useRef(new Set<string>());
  const pendingReads=useRef(new Set<string>());
  const rootRef=useRef<HTMLDivElement>(null);
  const queryClient=useQueryClient();
  const uploadAbort=useRef(new AbortController());
  useEffect(()=>()=>uploadAbort.current.abort(),[]);

  const messages = query.messages;
  // Tell the provider what is on screen: an incoming message is only "read" when the reader is at the bottom.
  useEffect(() => {
    reportView({ conversationId: conversationId ?? null, atBottom: atBottom && visible });
    return () => reportView({ conversationId: null, atBottom: false });
  }, [reportView, conversationId, atBottom, visible]);

  // Only the actually visible message bubbles in an active document are read. Lists/previews never call this.
  useEffect(()=>{
    const root=rootRef.current?.querySelector('[data-testid="chat-messages"]') ?? rootRef.current;
    if(!root||!conversationId||!visible)return;
    const seen=new Set<string>();
    let timer:ReturnType<typeof setTimeout>|undefined;
    const flush=()=>{if(document.visibilityState!=="visible")return;const ids=[...seen].filter(id=>!confirmedReads.current.has(id)&&!pendingReads.current.has(id));seen.clear();for(let i=0;i<ids.length;i+=100){const batch=ids.slice(i,i+100);batch.forEach(id=>pendingReads.current.add(id));void markRead(conversationId,batch).then(()=>batch.forEach(id=>confirmedReads.current.add(id))).catch(()=>{/* Reopen, foreground or a new history page retries failures. */}).finally(()=>batch.forEach(id=>pendingReads.current.delete(id)));}};
    const observer=new IntersectionObserver(entries=>{for(const entry of entries){const id=(entry.target as HTMLElement).dataset.messageId;if(!id)continue;if(entry.isIntersecting)seen.add(id);else seen.delete(id);}clearTimeout(timer);timer=setTimeout(flush,500);},{root,threshold:0.01});
    root.querySelectorAll('[data-message-id]').forEach(el=>observer.observe(el));
    return ()=>{observer.disconnect();clearTimeout(timer);};
  },[conversationId,visible,messages,markRead]);

  // Automatically acknowledge delivery of messages received by the client (REST catch-up or initial load).
  const confirmedDeliveries = useRef(new Set<string>());
  useEffect(() => {
    if (!accountId || !conversationId || !messages.length) return;
    const incoming = messages
      .filter((m) => m.sender.userId !== selfId && !confirmedDeliveries.current.has(m.id))
      .map((m) => m.id);
    if (incoming.length === 0) return;
    incoming.forEach((id) => confirmedDeliveries.current.add(id));
    for (let i = 0; i < incoming.length; i += 100) {
      const batch = incoming.slice(i, i + 100);
      void chatApi.markDelivered(accountId, conversationId, batch).catch(() => {});
    }
  }, [accountId, conversationId, messages, selfId]);

  // Leaving a conversation (or closing the chat) ends the "typing" announced for it.
  useEffect(() => () => { if (conversationId) notifyTyping(conversationId, "stopped"); }, [conversationId, notifyTyping]);

  const opening = !conversationId;

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col" data-testid="chat-conversation">
      {opening && active?.kind !== "direct" ? <p className="flex-1 p-6 text-sm text-muted-foreground">{t("selectConversation")}</p> : opening ? (
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
          onReply={chooseReply}
          onReact={(messageId,code,add)=>{void chat.react(messageId,code,add).catch(error=>toast.error(`${t("reactions.error")} ${te(errorKey(error))}`));}}
          reactionPending={chat.reactionPending}
          reactionsDisabled={chat.sendBlocked}
          onDelete={chat.deleteMessage}
          receipts={receipts.data ?? NO_RECEIPTS}
        />
      )}
      <TypingIndicator people={chat.typingPeople} />
      <MessageComposer
        key={key}
        onTyping={(state) => { if (conversationId) notifyTyping(conversationId, state); }}
        draftKey={key}
        initialDraft={chat.getDraft(key)}
        onDraftChange={(text) => chat.setDraft(key, text)}
        onSend={async (text,file) => {
          if(!conversationId)return false;
          if(!file) {const valid=chat.send(conversationId,text,reply).ok;if(valid)cancelReply();return valid;}
          try {
            const message=await chatApi.sendFile(conversationId,file,text,reply?.id,uploadAbort.current.signal);
            if(uploadAbort.current.signal.aborted)return false;
            appendMessages(queryClient,accountId!,conversationId,[message]);
            void queryClient.invalidateQueries({queryKey:chatKeys.overview(accountId!)});
            cancelReply();return true;
          }catch(error){if(!uploadAbort.current.signal.aborted)toast.error(`${t("files.failed")} ${te(errorKey(error))}`);return false;}
        }}
        disabled={opening || chat.sendBlocked}
        disabledReason={chat.sendBlocked ? t("disconnected") : undefined}
        autoFocus={autoFocus}
        reply={reply}
        onCancelReply={cancelReply}
      />
    </div>
  );
}
