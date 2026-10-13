"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api/client";
import { toast } from "sonner";
import { useSession } from "@/features/auth/hooks/use-session";




import { errorKey } from "@/lib/api/error-message";
import { chatApi } from "./api";
import {
  appendMessages,
  applyMessageToOverview,
  applyReactionSnapshots,
  applyMessageDeleted,
  applyMessagesDelivered,
  flattenMessages,
  chatKeys,
  newestMessageId,
  type MessagePages,
} from "./cache";
import { useChatMembers, useChatOverview, useMarkRead, useOpenDirect } from "./hooks";
import { normalizeMessage, validateMessage, type MessageValidation } from "./limits";
import type {
  ActiveConversation,
  ChatConnection,
  ChatMember,
  ChatMode,
  ChatOverview,
  ChatSocketEvent,
  ChatUser,
  PendingMessage,
  ChatReply,
  ReactionCode,
  TypingPerson,
} from "./types";
import { useChatSocket } from "./use-chat-socket";
import { TypingEmitter, TypingTracker, type TypingSnapshot } from "./typing";
import { ReactionBuffer } from "./reactions";
import { ReactionSyncQueue, resyncReactions } from "./reaction-resync";
import { pendingMatches } from "./pending";

const NO_TYPING: TypingPerson[] = [];

function chatLifetime() {
  return { active: true, messageIds: new Set<string>(), reactions: new ReactionBuffer(), abort: new AbortController(),
    queue: new ReactionSyncQueue(), resyncs: new Map<string, Promise<void>>() };
}

/** Project slug of a `/projects/[slug]/...` route; `/projects/new` and the list are not a project. */
export function chatRouteSlug(pathname: string): string | undefined {
  const slug = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname)?.[1];
  return slug && slug !== "new" ? slug : undefined;
}

/** Key a draft is stored under: stable before and after a direct conversation gets its server id. */
export function draftKey(active: ActiveConversation): string {
  return active.kind === "group" ? `group:${active.conversationId ?? "default"}` : `direct:${active.peerId}`;
}

type State = {
  /** The selected workspace project, independent of the current page. */
  slug?: string;
  ownerKey?: string;
  pageKey?: string;
  mode: ChatMode;
  active: ActiveConversation | null;
  /** Messages being sent or failed, by conversation id. */
  outbox: Record<string, PendingMessage[]>;
};

const initialState: State = { mode: "closed", active: null, outbox: {} };

type Action =
  | { type: "context"; slug?: string; ownerKey: string; pageKey: string }
  | { type: "navigation"; pageKey?: string }
  | { type: "open"; initial?: ActiveConversation | null }
  | { type: "mode"; mode: ChatMode }
  | { type: "select"; active: ActiveConversation | null }
  | { type: "resolveDirect"; peerId: string; conversationId: string }
  | { type: "outboxAdd"; conversationId: string; pending: PendingMessage }
  | { type: "outboxPatch"; conversationId: string; clientId: string; patch: Partial<PendingMessage> }
  | { type: "outboxRemove"; conversationId: string; clientId: string }
  | { type: "outboxConsume"; conversationId: string; content: string; replyId?: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "context": return { ...initialState, slug: action.slug, ownerKey: action.ownerKey, pageKey: action.pageKey };
    case "navigation": return { ...state, pageKey: action.pageKey ?? state.pageKey, mode: state.mode === "full" ? "closed" : state.mode };
    case "open":
      if (!state.slug) return state;
      return { ...state, mode: "full", active: state.active ?? action.initial ?? null };
    case "mode":
      return state.slug ? { ...state, mode: action.mode } : state;
    case "select":
      return { ...state, active: action.active };
    case "resolveDirect": {
      const active = state.active;
      if (active?.kind !== "direct" || active.peerId !== action.peerId) return state;
      return { ...state, active: { ...active, conversationId: action.conversationId } };
    }
    case "outboxAdd":
      return {
        ...state,
        outbox: { ...state.outbox, [action.conversationId]: [...(state.outbox[action.conversationId] ?? []), action.pending] },
      };
    case "outboxPatch":
      return {
        ...state,
        outbox: {
          ...state.outbox,
          [action.conversationId]: (state.outbox[action.conversationId] ?? []).map((pending) =>
            pending.clientId === action.clientId ? { ...pending, ...action.patch } : pending,
          ),
        },
      };
    case "outboxRemove":
      return {
        ...state,
        outbox: {
          ...state.outbox,
          [action.conversationId]: (state.outbox[action.conversationId] ?? []).filter(
            (pending) => pending.clientId !== action.clientId,
          ),
        },
      };
    case "outboxConsume": {
      const list = state.outbox[action.conversationId] ?? [];
      const index = list.findIndex((pending) => pendingMatches(pending, action.content, action.replyId));
      if (index < 0) return state;
      return { ...state, outbox: { ...state.outbox, [action.conversationId]: list.filter((_, i) => i !== index) } };
    }
  }
}

type ViewState = { conversationId: string | null; atBottom: boolean };

type ChatContextValue = {
  /** The selected workspace project. Undefined while resolving or when access is unavailable. */
  accountId?: string;
  /** The project's own name and logo: the project group conversation is shown under them. Undefined while loading. */
  projectName?: string;
  projectLogoSrc: string | null;
  projectLogoShape: import("@/lib/media/logo-shape").LogoShape;
  mode: ChatMode;
  active: ActiveConversation | null;
  activeConversationId?: string;
  /** The other person of the active direct conversation. */
  activePeer: ChatUser | null;
  connection: ChatConnection;
  /** Sending is paused while the connection is known to be down. */
  sendBlocked: boolean;
  overview?: ChatOverview;
  overviewStatus: "pending" | "error" | "success";
  refetchOverview: () => void;
  members?: ChatMember[];
  membersStatus: "pending" | "error" | "success";
  refetchMembers: () => void;
  openingDirect: boolean;
  open: () => void;
  minimize: () => void;
  expandCompact: () => void;
  expandFull: () => void;
  close: () => void;
  navigatePage: () => void;
  selectGroup: (conversationId?: string) => void;
  selectPeer: (peerId: string, conversationId?: string | null) => void;
  getDraft: (key: string) => string;
  setDraft: (key: string, text: string) => void;
  getReply: (key: string) => ChatReply | null;
  setReply: (key: string, reply: ChatReply | null) => void;
  react: (messageId: string, code: ReactionCode, add: boolean) => Promise<void>;
  reactionPending: (messageId: string, code: ReactionCode) => boolean;
  deleteMessage: (messageId: string) => Promise<void>;
  outboxFor: (conversationId: string | undefined) => PendingMessage[];
  send: (conversationId: string, text: string, reply?: ChatReply | null) => MessageValidation;
  retry: (conversationId: string, clientId: string) => void;
  discard: (conversationId: string, clientId: string) => void;
  /** The conversation view reports what is on screen so unread counting and read marking know about it. */
  reportView: (view: ViewState) => void;
  markRead: (conversationId: string, messageIds: string[]) => Promise<void>;
  /** Other people typing in the active conversation (never the signed-in user). */
  typingPeople: TypingPerson[];
  /** The composer reports its state: keystrokes (`typing`), an emptied box or a left conversation (`stopped`), a sent message (`sent`). */
  notifyTyping: (conversationId: string, state: "typing" | "stopped" | "sent") => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useOptionalChat() { return useContext(ChatContext); }

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used inside ChatProvider");
  return value;
}

/**
 * One chat for the selected workspace project. The selection is shared with the sidebar and calendar. Only an
 * account/project change resets its state and lifetime; page components stay mounted while selection resolves.
 */
export function ChatProvider({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageKey = `${pathname}?section=${searchParams.get("section") ?? ""}`;
  const { data: user } = useSession();
  return <AccountChatProvider ownerKey={disabled ? "disabled" : user?.id ?? "none"} slug={disabled ? undefined : user?.id} selfId={disabled ? undefined : user?.id} pageKey={pageKey}>{children}</AccountChatProvider>;
}

function AccountChatProvider({ children, slug, selfId, ownerKey, pageKey }: {
  children: ReactNode; slug?: string; selfId?: string; ownerKey: string; pageKey: string;
}) {
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, { ...initialState, slug, ownerKey, pageKey });
  // React rerenders this owner before committing: B never receives A's visible state. Children keep their identity.
  if (state.ownerKey !== ownerKey) dispatch({ type: "context", slug, ownerKey, pageKey });
  else if (state.pageKey !== pageKey) dispatch({ type: "navigation", pageKey });
  const accountId = selfId; // Actor-scoped central chat cache, independent of workspace selection.
  const shown = state.mode !== "closed";

  // ---- refs the socket callbacks read (they must not change identity) ----------------------------------------------
  const accountIdRef = useRef(accountId);
  const selfIdRef = useRef(selfId);
  const modeRef = useRef(state.mode);
  const viewRef = useRef<ViewState>({ conversationId: null, atBottom: false });
  const draftsRef = useRef<Record<string, string>>({});
  const repliesRef = useRef<Record<string, ChatReply>>({});
  const [reactionPendingKeys, setReactionPendingKeys] = useState<Set<string>>(new Set());
  const pendingReactionsRef = useRef<Set<string>>(new Set());
  const triggerRef = useRef<HTMLElement | null>(null);
  const connectionRef = useRef<ChatConnection>("connecting");
  // Typing state is ephemeral: it lives only in the browser and expires on its own (see typing.ts).
  const [typingSnapshot, setTypingSnapshot] = useState<TypingSnapshot>({});
  const [typingTracker] = useState(() => new TypingTracker(setTypingSnapshot));
  const [typingEmitter] = useState(() => new TypingEmitter());
  // Each account/project transition is a distinct generation, including a quick A -> B -> A trip.
  const lifetimeRef = useRef(chatLifetime());
  useEffect(() => {
    typingEmitter.setSender((conversationId, typing) => {
      const pid = accountIdRef.current;
      const lifetime = lifetimeRef.current;
      // A signal is only worth sending while the socket is up and the project is the one the user sees.
      if (!pid || !lifetime.active || connectionRef.current !== "connected") return;
      void chatApi.typing(pid, conversationId, typing, lifetime.abort.signal).catch(() => { /* best effort: the next keystroke repeats it */ });
    });
  }, [typingEmitter]);
  useEffect(() => {
    const lifetime = chatLifetime();
    lifetimeRef.current = lifetime;
    return () => { lifetime.active = false; lifetime.abort.abort(); lifetime.reactions.clear(); };
  }, [ownerKey]);
  useEffect(() => {
    accountIdRef.current = accountId;
    selfIdRef.current = selfId;
    modeRef.current = state.mode;
  });
  // Another account/project, or leaving the workspace: nobody's typing state may carry over.
  useEffect(() => () => { typingEmitter.cancel(); typingTracker.clearAll(); }, [ownerKey, typingEmitter, typingTracker]);

  // A project switch also drops that project's drafts and loaded history (the state itself reset in the reducer).
  useEffect(() => {
    if (!accountId) return;
    return () => {
      draftsRef.current = {};
      repliesRef.current = {};
      pendingReactionsRef.current = new Set();
      setReactionPendingKeys(new Set());
      viewRef.current = { conversationId: null, atBottom: false };
      void queryClient.cancelQueries({ queryKey: chatKeys.all(accountId) });
      queryClient.removeQueries({ queryKey: chatKeys.all(accountId) });
    };
  }, [accountId, queryClient, ownerKey]);

  const syncReactions = useCallback((conversationId: string) => {
    const pid = accountIdRef.current;
    const lifetime = lifetimeRef.current;
    if (!pid || !lifetime.active) return Promise.resolve();
    const running = lifetime.resyncs.get(conversationId);
    if (running) return running;
    const job = resyncReactions(queryClient, pid, conversationId, (ids, signal) => chatApi.reactionSnapshots(pid, conversationId, ids, signal),
      { signal: lifetime.abort.signal, queue: lifetime.queue, current: () => lifetime.active && lifetimeRef.current === lifetime && accountIdRef.current === pid })
      .catch(() => { /* Reopen/reconnect retries; keep authoritative newer frames. */ })
      .finally(() => lifetime.resyncs.delete(conversationId));
    lifetime.resyncs.set(conversationId, job);
    return job;
  }, [queryClient]);

  // A history page can arrive after its reaction frame. Remove buffered entries
  // before setQueryData, because query-cache notifications are synchronous.
  useEffect(() => {
    if (!accountId) return;
    const lifetime = lifetimeRef.current;
    return queryClient.getQueryCache().subscribe(event => {
      if (!lifetime.active || event.type !== "updated") return;
      const key = event.query.queryKey;
      if (key[0] !== "accounts" || key[1] !== accountId || key[2] !== "chat" || key[3] !== "messages" || typeof key[4] !== "string") return;
      const data = queryClient.getQueryData<MessagePages>(key);
      const ids = new Set(flattenMessages(data).map(message => message.id));
      const buffered = lifetime.reactions.takeLoaded(key[4], ids);
      if (buffered.length) applyReactionSnapshots(queryClient, accountId, key[4], buffered);
    });
  }, [accountId, queryClient, ownerKey]);

  // ---- real-time ---------------------------------------------------------------------------------------------------
  const handleEvent = useCallback(
    (event: ChatSocketEvent) => {
      const pid = accountIdRef.current;
      const lifetime = lifetimeRef.current;
      if (!lifetime.active || !pid) return;
      if (event.type !== "TYPING") {
        void queryClient.invalidateQueries({ queryKey: chatKeys.contextRoot(pid, event.conversationId) });
        if (event.type === "MESSAGE" || event.type === "DELETED") {
          void queryClient.cancelQueries({ queryKey: chatKeys.searchRoot(pid, event.conversationId) }).then(() => {
            if (lifetime.active && lifetimeRef.current === lifetime && accountIdRef.current === pid)
              void queryClient.invalidateQueries({ queryKey: chatKeys.searchRoot(pid, event.conversationId) });
          });
        }
      }
      if (event.type === "READ") {
        void queryClient.invalidateQueries({queryKey:chatKeys.overview(pid)});
        return;
      }
      if (event.type === "DELIVERED") {
        applyMessagesDelivered(queryClient, pid, event.conversationId, event.messageIds);
        return;
      }
      if (event.type === "TYPING") {
        // The server never echoes a typist to themselves; this also covers a second tab of the same account.
        if (event.userId === selfIdRef.current) return;
        if (event.typing) typingTracker.set(event.conversationId, { userId: event.userId, nickname: event.nickname });
        else typingTracker.clear(event.conversationId, event.userId);
        return;
      }
      if (event.type === "SEEN") {
        // SEEN is a conversation timestamp signal, not proof of exact IDs or all recipients.
        void queryClient.invalidateQueries({queryKey:chatKeys.messages(pid,event.conversationId)});
        void queryClient.invalidateQueries({queryKey:chatKeys.receipts(pid,event.conversationId)});
        void queryClient.invalidateQueries({queryKey:chatKeys.infoRoot(pid,event.conversationId)});
        return;
      }
      if (event.type === "DELETED") {
        // A history request started before deletion must not replace the confirmed tombstone.
        void queryClient.cancelQueries({ queryKey: chatKeys.messages(pid, event.conversationId) }).then(() => {
          if (!lifetime.active || lifetimeRef.current !== lifetime || accountIdRef.current !== pid) return;
          applyMessageDeleted(queryClient, pid, event.conversationId, event.messageId);
          // Previews and unread counts of the conversation list came from the server; refresh them.
          void queryClient.invalidateQueries({ queryKey: chatKeys.overview(pid) });
        });
        return;
      }
      if (event.type === "REACTIONS") {
        const found = applyReactionSnapshots(queryClient, pid, event.conversationId, [event]);
        if (!found.has(event.messageId)) lifetimeRef.current.reactions.put(event.conversationId, event);
        return;
      }
      const message = event.message;
      if (!message || message.conversationId !== event.conversationId) return;
      // A sent message ends that person's "typing" at once.
      typingTracker.clear(message.conversationId, message.sender.userId);
      // Renewal briefly keeps both subscriptions alive. Process a delivered message once, including unread/outbox.
      const messageIds = lifetimeRef.current.messageIds;
      if (messageIds.has(message.id)) return;
      messageIds.add(message.id);
      // Retain recent delivery IDs without growing for the entire workspace session.
      if (messageIds.size > 1000) messageIds.delete(messageIds.values().next().value!);
      const mine = message.sender.userId === selfIdRef.current;
      appendMessages(queryClient, pid, message.conversationId, [message]);
      if (mine) {
        dispatch({ type: "outboxConsume", conversationId: message.conversationId, content: message.content, replyId: message.replyTo?.id });
      } else {
        void chatApi.markDelivered(pid, message.conversationId, [message.id]).catch(() => {});
      }
      const view = viewRef.current;
      const viewing =
        view.conversationId === message.conversationId &&
        view.atBottom &&
        (modeRef.current === "full" || modeRef.current === "compact") &&
        document.visibilityState === "visible";
      const known = applyMessageToOverview(queryClient, pid, message, { mine, viewing });
      if (!known) {
        // First message of a direct conversation this browser has not seen yet.
        void queryClient.invalidateQueries({ queryKey: chatKeys.overview(pid) });
        void queryClient.invalidateQueries({ queryKey: chatKeys.members(pid) });
      }
    },
    [queryClient, typingTracker],
  );

  /** Whatever happened while the socket was down is fetched over REST: no message is lost on a reconnect. */
  const handleConnect = useCallback((reconnect: boolean) => {
    const pid = accountIdRef.current;
    const lifetime = lifetimeRef.current;
    if (!lifetime.active || !pid) return;
    if (reconnect) {
      void queryClient.invalidateQueries({ queryKey: chatKeys.overview(pid) });
      // A deletion announced while the socket was down is not part of the "newer messages" catch-up below.
      void queryClient.invalidateQueries({ queryKey: chatKeys.messagesRoot(pid) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.receiptsRoot(pid) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.infoFamily(pid) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.searchRoot(pid) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.contextRoot(pid) });
    }
    const loaded = queryClient.getQueriesData<MessagePages>({ queryKey: chatKeys.messagesRoot(pid) });
    void (async () => {
      for (const [key, data] of loaded) {
        const conversationId = key[4] as string;
        await syncReactions(conversationId);
        if (!lifetime.active || accountIdRef.current !== pid) return;
        let cursor = newestMessageId(data);
        if (!data) continue;
        if (!cursor) {
          // Loaded but empty: anything now is news, so fetch it fresh.
          void queryClient.invalidateQueries({ queryKey: key });
          continue;
        }
        try {
          for (let round = 0; round < 20 && cursor; round += 1) {
            const page = await chatApi.messages(pid, conversationId, { after: cursor, limit: 100 });
            if (!lifetime.active || accountIdRef.current !== pid) return;
            appendMessages(queryClient, pid, conversationId, page.messages);
            if (!page.hasMore || page.messages.length === 0) break;
            cursor = page.messages[page.messages.length - 1].id;
          }
        } catch {
          // Offline again; the next reconnect repeats the catch-up.
        }
      }
    })();
  }, [queryClient, syncReactions]);

  const connection = useChatSocket({ contextKey: accountId && selfId ? `${selfId}:${accountId}` : undefined, onEvent: handleEvent, onConnect: handleConnect });

  useEffect(() => {
    connectionRef.current = connection;
    // A dropped socket may have swallowed "stopped" signals in both directions: start clean instead of guessing.
    if (connection !== "connected") { typingEmitter.cancel(); typingTracker.clearAll(); }
  }, [connection, typingEmitter, typingTracker]);

  const notifyTyping = useCallback((conversationId: string, state: "typing" | "stopped" | "sent") => {
    if (state === "typing") typingEmitter.typing(conversationId);
    else if (state === "stopped") typingEmitter.stop();
    else typingEmitter.cancel();
  }, [typingEmitter]);

  // ---- data --------------------------------------------------------------------------------------------------------
  // Membership/project changes do not publish chat events; polling also reconciles that authorization boundary.
  const overviewQuery = useChatOverview(accountId, { poll: true });
  const membersQuery = useChatMembers(accountId, shown);
  const openDirect = useOpenDirect(accountId);
  const markReadMutation = useMarkRead(accountId, ownerKey);
  const overview = overviewQuery.data;

  const active = state.active;
  const activePeerId = active?.kind === "direct" ? active.peerId : undefined;
  const activeConversationId =
    active === null
      ? undefined
      : active.kind === "group"
        ? (active.conversationId ? overview?.groups.find(group => group.id === active.conversationId)?.id : overview?.group?.id)
        : (active.conversationId ?? overview?.directs.find((direct) => direct.peer?.userId === active.peerId)?.id);
  const activePeer = useMemo<ChatUser | null>(() => {
    if (!activePeerId) return null;
    const fromDirects = overview?.directs.find((direct) => direct.peer?.userId === activePeerId)?.peer;
    if (fromDirects) return fromDirects;
    return membersQuery.data?.find((member) => member.userId === activePeerId) ?? null;
  }, [activePeerId, overview, membersQuery.data]);

  const activeGroup = overview?.groups.find(g => g.id === activeConversationId);
  const projectName = activeGroup?.projectName;
  const projectLogoShape = activeGroup?.logoShape ?? "SQUARE";
  const projectLogoSrc = activeGroup?.projectId && activeGroup.logoVersion ? apiUrl(`/projects/${activeGroup.projectId}/logo?v=${activeGroup.logoVersion}`) : null;
  const typingPeople = (activeConversationId && typingSnapshot[activeConversationId]) || NO_TYPING;

  useEffect(() => {
    if (shown && activeConversationId) void syncReactions(activeConversationId);
  }, [shown, activeConversationId, syncReactions, ownerKey]);

  // ---- panel state -------------------------------------------------------------------------------------------------
  const open = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) triggerRef.current = document.activeElement;
    const actor = accountIdRef.current;
    const current = actor ? queryClient.getQueryData<ChatOverview>(chatKeys.overview(actor)) : undefined;
    const group = current?.groups[0];
    const direct = current?.directs[0];
    dispatch({ type: "open", initial: group ? { kind: "group", conversationId: group.id }
      : direct?.peer ? { kind: "direct", peerId: direct.peer.userId, conversationId: direct.id } : null });
    if (actor) {
      void queryClient.invalidateQueries({ queryKey: chatKeys.overview(actor) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.members(actor) });
    }
  }, [queryClient]);
  const minimize = useCallback(() => dispatch({ type: "mode", mode: "bar" }), []);
  const navigatePage = useCallback(() => dispatch({ type: "navigation" }), []);
  const expandCompact = useCallback(() => dispatch({ type: "mode", mode: "compact" }), []);
  const expandFull = useCallback(() => dispatch({ type: "mode", mode: "full" }), []);
  const close = useCallback(() => {
    dispatch({ type: "mode", mode: "closed" });
    const trigger = triggerRef.current;
    // Focus goes back to what opened the chat (after the panel has left the DOM).
    if (trigger) queueMicrotask(() => trigger.isConnected && trigger.focus());
  }, []);

  const selectGroup = useCallback((conversationId?: string) => {
    const actor = accountIdRef.current;
    const current = actor ? queryClient.getQueryData<ChatOverview>(chatKeys.overview(actor)) : undefined;
    const id = conversationId ?? current?.groups[0]?.id;
    dispatch({ type: "select", active: id ? { kind: "group", conversationId: id } : null });
  }, [queryClient]);
  const selectPeer = useCallback(
    (peerId: string, conversationId?: string | null) => {
      if (conversationId) {
        dispatch({ type: "select", active: { kind: "direct", peerId, conversationId } });
        return;
      }
      dispatch({ type: "select", active: { kind: "direct", peerId } });
      const lifetime = lifetimeRef.current;
      openDirect.mutate(peerId, {
        onSuccess: (conversation) => {
          if (!lifetime.active) return;
          dispatch({ type: "resolveDirect", peerId, conversationId: conversation.id });
          if (accountId) {
            void queryClient.invalidateQueries({ queryKey: chatKeys.overview(accountId) });
            void queryClient.invalidateQueries({ queryKey: chatKeys.members(accountId) });
          }
        },
        onError: (error) => {
          if (!lifetime.active) return;
          toast.error(te(errorKey(error)));
          dispatch({ type: "select", active: null });
        },
      });
    },
    // `openDirect.mutate` is stable; `te` changes only with the locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openDirect.mutate, te, accountId, queryClient],
  );

  // ---- drafts, sending, reading ------------------------------------------------------------------------------------
  const getDraft = useCallback((key: string) => draftsRef.current[key] ?? "", []);
  const setDraft = useCallback((key: string, text: string) => {
    if (text === "") delete draftsRef.current[key];
    else draftsRef.current[key] = text;
  }, []);
  const getReply = useCallback((key: string) => repliesRef.current[key] ?? null, []);
  const setReply = useCallback((key: string, reply: ChatReply | null) => {
    if (reply) repliesRef.current[key] = reply; else delete repliesRef.current[key];
  }, []);

  const react = useCallback(async (messageId: string, code: ReactionCode, add: boolean) => {
    const pid = accountIdRef.current, cid = activeConversationId, lifetime = lifetimeRef.current;
    const key = `${cid}:${messageId}:${code}`;
    if (!pid || !cid || !lifetime.active || pendingReactionsRef.current.has(key)) return;
    const pending = pendingReactionsRef.current;
    pending.add(key); setReactionPendingKeys(new Set(pending));
    try {
      const snapshot = await chatApi.react(pid, cid, messageId, code, add, lifetime.abort.signal);
      if (lifetime.active && accountIdRef.current === pid) applyReactionSnapshots(queryClient, pid, cid, [snapshot]);
    } catch (error) {
      if (lifetime.active) throw error;
    } finally {
      pending.delete(key);
      if (lifetime.active) setReactionPendingKeys(new Set(pending));
    }
  }, [activeConversationId, queryClient]);
  const reactionPending = useCallback((messageId: string, code: ReactionCode) => reactionPendingKeys.has(`${activeConversationId}:${messageId}:${code}`), [reactionPendingKeys, activeConversationId]);

  /** Deletes an own message; the tombstone appears once the server confirmed (errors are the caller's to show). */
  const deleteMessage = useCallback(async (messageId: string) => {
    const pid = accountIdRef.current, cid = activeConversationId, lifetime = lifetimeRef.current;
    if (!pid || !cid || !lifetime.active) return;
    await chatApi.deleteMessage(pid, cid, messageId, lifetime.abort.signal);
    if (!lifetime.active || lifetimeRef.current !== lifetime || accountIdRef.current !== pid) return;
    await queryClient.cancelQueries({ queryKey: chatKeys.messages(pid, cid) });
    if (!lifetime.active || lifetimeRef.current !== lifetime || accountIdRef.current !== pid) return;
    applyMessageDeleted(queryClient, pid, cid, messageId);
    await queryClient.cancelQueries({ queryKey: chatKeys.searchRoot(pid, cid) });
    if (!lifetime.active || lifetimeRef.current !== lifetime || accountIdRef.current !== pid) return;
    void queryClient.invalidateQueries({ queryKey: chatKeys.searchRoot(pid, cid) });
    void queryClient.invalidateQueries({ queryKey: chatKeys.contextRoot(pid, cid) });
    void queryClient.invalidateQueries({ queryKey: chatKeys.overview(pid) });
  }, [activeConversationId, queryClient]);

  const deliver = useCallback(
    async (conversationId: string, clientId: string, content: string, reply?: ChatReply | null) => {
      const pid = accountIdRef.current;
      const lifetime = lifetimeRef.current;
      if (!lifetime.active || !pid) return;
      try {
        const message = await chatApi.send(pid, conversationId, content, reply?.id, lifetime.abort.signal);
        if (!lifetime.active || accountIdRef.current !== pid) return;
        appendMessages(queryClient, pid, conversationId, [message]);
        applyMessageToOverview(queryClient, pid, message, { mine: true, viewing: true });
        dispatch({ type: "outboxRemove", conversationId, clientId });
      } catch (error) {
        if (!lifetime.active || accountIdRef.current !== pid) return;
        dispatch({
          type: "outboxPatch",
          conversationId,
          clientId,
          patch: { status: "failed", errorKey: errorKey(error) },
        });
      }
    },
    [queryClient],
  );

  const send = useCallback(
    (conversationId: string, text: string, reply?: ChatReply | null): MessageValidation => {
      const validation = validateMessage(text);
      if (!validation.ok) return validation;
      const clientId = crypto.randomUUID();
      dispatch({
        type: "outboxAdd",
        conversationId,
        pending: { clientId, content: validation.content, status: "sending", sentAt: Date.now(), replyTo: reply ?? null },
      });
      void deliver(conversationId, clientId, validation.content, reply);
      return validation;
    },
    [deliver],
  );

  const outboxRef = useRef(state.outbox);
  useEffect(() => {
    outboxRef.current = state.outbox;
  });
  const retry = useCallback(
    (conversationId: string, clientId: string) => {
      const pending = outboxRef.current[conversationId]?.find((item) => item.clientId === clientId);
      if (!pending) return;
      dispatch({ type: "outboxPatch", conversationId, clientId, patch: { status: "sending", errorKey: undefined } });
      void deliver(conversationId, clientId, normalizeMessage(pending.content), pending.replyTo);
    },
    [deliver],
  );
  const discard = useCallback(
    (conversationId: string, clientId: string) => dispatch({ type: "outboxRemove", conversationId, clientId }),
    [],
  );
  const outboxFor = useCallback(
    (conversationId: string | undefined) => (conversationId ? (state.outbox[conversationId] ?? []) : []),
    [state.outbox],
  );

  const reportView = useCallback((view: ViewState) => {
    viewRef.current = view;
  }, []);
  const markRead = useCallback(
    (conversationId: string,messageIds: string[]) => markReadMutation.mutateAsync({conversationId,messageIds}),
    // `mutate` is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markReadMutation.mutateAsync],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      accountId,
      projectName,
      projectLogoSrc,
      projectLogoShape,
      mode: state.mode,
      active,
      activeConversationId,
      activePeer,
      connection,
      sendBlocked: connection === "disconnected",
      overview,
      overviewStatus: overviewQuery.status,
      refetchOverview: () => void overviewQuery.refetch(),
      members: membersQuery.data,
      membersStatus: membersQuery.status,
      refetchMembers: () => void membersQuery.refetch(),
      openingDirect: openDirect.isPending,
      open,
      minimize,
      expandCompact,
      expandFull,
      close,
      navigatePage,
      selectGroup,
      selectPeer,
      getDraft,
      setDraft,
      getReply,
      setReply,
      react,
      reactionPending,
      deleteMessage,
      outboxFor,
      send,
      retry,
      discard,
      reportView,
      markRead,
      typingPeople,
      notifyTyping,
    }),
    // The query objects change identity every render; their data/status are what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      accountId, projectName, projectLogoSrc, projectLogoShape, slug, state.mode, active, activeConversationId, activePeer, connection, overview,
      overviewQuery.status, membersQuery.data, membersQuery.status, openDirect.isPending, open,
      minimize, expandCompact, expandFull, close, navigatePage, selectGroup, selectPeer, getDraft, setDraft, outboxFor, send,
      retry, discard, reportView, markRead, getReply, setReply, react, reactionPending, deleteMessage, typingPeople, notifyTyping,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
