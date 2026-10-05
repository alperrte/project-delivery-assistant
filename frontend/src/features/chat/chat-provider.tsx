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
import { toast } from "sonner";
import { useSession } from "@/features/auth/hooks/use-session";
import { projectLogoSource } from "@/features/projects/api";
import { useSelectedProject } from "@/features/projects/hooks/use-selected-project";
import type { Project } from "@/features/projects/types";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { chatApi } from "./api";
import {
  appendMessages,
  applyMessageToOverview,
  applyReadToOverview,
  applyReactionSnapshots,
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
} from "./types";
import { useChatSocket } from "./use-chat-socket";
import { ReactionBuffer } from "./reactions";
import { ReactionSyncQueue, resyncReactions } from "./reaction-resync";
import { pendingMatches } from "./pending";

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
  return active.kind === "group" ? "group" : `direct:${active.peerId}`;
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
  | { type: "open" }
  | { type: "mode"; mode: ChatMode }
  | { type: "select"; active: ActiveConversation }
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
      return { ...state, mode: "full", active: state.active ?? { kind: "group" } };
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
  projectId?: string;
  /** The project's own name and logo: the project group conversation is shown under them. Undefined while loading. */
  projectName?: string;
  projectLogoSrc: string | null;
  contextSlug?: string;
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
  selectGroup: () => void;
  selectPeer: (peerId: string, conversationId?: string | null) => void;
  getDraft: (key: string) => string;
  setDraft: (key: string, text: string) => void;
  getReply: (key: string) => ChatReply | null;
  setReply: (key: string, reply: ChatReply | null) => void;
  react: (messageId: string, code: ReactionCode, add: boolean) => Promise<void>;
  reactionPending: (messageId: string, code: ReactionCode) => boolean;
  outboxFor: (conversationId: string | undefined) => PendingMessage[];
  send: (conversationId: string, text: string, reply?: ChatReply | null) => MessageValidation;
  retry: (conversationId: string, clientId: string) => void;
  discard: (conversationId: string, clientId: string) => void;
  /** The conversation view reports what is on screen so unread counting and read marking know about it. */
  reportView: (view: ViewState) => void;
  markRead: (conversationId: string) => void;
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
  const routeSlug = chatRouteSlug(pathname);
  const { data: user } = useSession();
  const { slug, project, error } = useSelectedProject(routeSlug);
  const unavailable = error instanceof ApiError && (error.status === 403 || error.status === 404);
  const contextSlug = disabled || unavailable ? undefined : slug;
  return (
    <ProjectChatProvider ownerKey={`${user?.id ?? "none"}:${contextSlug ?? "none"}`} slug={contextSlug}
      project={contextSlug && project?.slug === contextSlug ? project : undefined} selfId={disabled ? undefined : user?.id} pageKey={pageKey}>
      {children}
    </ProjectChatProvider>
  );
}

function ProjectChatProvider({ children, slug, project, selfId, ownerKey, pageKey }: {
  children: ReactNode; slug?: string; project?: Project; selfId?: string; ownerKey: string; pageKey: string;
}) {
  const te = useTranslations("errors");
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, { ...initialState, slug, ownerKey, pageKey });
  // React rerenders this owner before committing: B never receives A's visible state. Children keep their identity.
  if (state.ownerKey !== ownerKey) dispatch({ type: "context", slug, ownerKey, pageKey });
  else if (state.pageKey !== pageKey) dispatch({ type: "navigation", pageKey });
  const projectId = project?.id;
  const projectName = project?.name;
  const projectLogoSrc = project ? projectLogoSource(project) : null;
  const shown = state.mode !== "closed";

  // ---- refs the socket callbacks read (they must not change identity) ----------------------------------------------
  const projectIdRef = useRef(projectId);
  const selfIdRef = useRef(selfId);
  const modeRef = useRef(state.mode);
  const viewRef = useRef<ViewState>({ conversationId: null, atBottom: false });
  const draftsRef = useRef<Record<string, string>>({});
  const repliesRef = useRef<Record<string, ChatReply>>({});
  const [reactionPendingKeys, setReactionPendingKeys] = useState<Set<string>>(new Set());
  const pendingReactionsRef = useRef<Set<string>>(new Set());
  const triggerRef = useRef<HTMLElement | null>(null);
  // Each account/project transition is a distinct generation, including a quick A -> B -> A trip.
  const lifetimeRef = useRef(chatLifetime());
  useEffect(() => {
    const lifetime = chatLifetime();
    lifetimeRef.current = lifetime;
    return () => { lifetime.active = false; lifetime.abort.abort(); lifetime.reactions.clear(); };
  }, [ownerKey]);
  useEffect(() => {
    projectIdRef.current = projectId;
    selfIdRef.current = selfId;
    modeRef.current = state.mode;
  });

  // A project switch also drops that project's drafts and loaded history (the state itself reset in the reducer).
  useEffect(() => {
    if (!projectId) return;
    return () => {
      draftsRef.current = {};
      repliesRef.current = {};
      pendingReactionsRef.current = new Set();
      setReactionPendingKeys(new Set());
      viewRef.current = { conversationId: null, atBottom: false };
      void queryClient.cancelQueries({ queryKey: chatKeys.all(projectId) });
      queryClient.removeQueries({ queryKey: chatKeys.all(projectId) });
    };
  }, [projectId, queryClient, ownerKey]);

  const syncReactions = useCallback((conversationId: string) => {
    const pid = projectIdRef.current;
    const lifetime = lifetimeRef.current;
    if (!pid || !lifetime.active) return Promise.resolve();
    const running = lifetime.resyncs.get(conversationId);
    if (running) return running;
    const job = resyncReactions(queryClient, pid, conversationId, (ids, signal) => chatApi.reactionSnapshots(pid, conversationId, ids, signal),
      { signal: lifetime.abort.signal, queue: lifetime.queue, current: () => lifetime.active && lifetimeRef.current === lifetime && projectIdRef.current === pid })
      .catch(() => { /* Reopen/reconnect retries; keep authoritative newer frames. */ })
      .finally(() => lifetime.resyncs.delete(conversationId));
    lifetime.resyncs.set(conversationId, job);
    return job;
  }, [queryClient]);

  // A history page can arrive after its reaction frame. Remove buffered entries
  // before setQueryData, because query-cache notifications are synchronous.
  useEffect(() => {
    if (!projectId) return;
    const lifetime = lifetimeRef.current;
    return queryClient.getQueryCache().subscribe(event => {
      if (!lifetime.active || event.type !== "updated") return;
      const key = event.query.queryKey;
      if (key[0] !== "projects" || key[1] !== projectId || key[2] !== "chat" || key[3] !== "messages" || typeof key[4] !== "string") return;
      const data = queryClient.getQueryData<MessagePages>(key);
      const ids = new Set(flattenMessages(data).map(message => message.id));
      const buffered = lifetime.reactions.takeLoaded(key[4], ids);
      if (buffered.length) applyReactionSnapshots(queryClient, projectId, key[4], buffered);
    });
  }, [projectId, queryClient, ownerKey]);

  // ---- real-time ---------------------------------------------------------------------------------------------------
  const handleEvent = useCallback(
    (event: ChatSocketEvent) => {
      const pid = projectIdRef.current;
      // Another project's event (a stale subscription, a bug, a hostile frame) never touches this project's state.
      if (!lifetimeRef.current.active || !pid || event.projectId !== pid) return;
      if (event.type === "READ") {
        applyReadToOverview(queryClient, pid, event.conversationId);
        return;
      }
      if (event.type === "REACTIONS") {
        const found = applyReactionSnapshots(queryClient, pid, event.conversationId, [event]);
        if (!found.has(event.messageId)) lifetimeRef.current.reactions.put(event.conversationId, event);
        return;
      }
      const message = event.message;
      if (!message || message.conversationId !== event.conversationId) return;
      // Renewal briefly keeps both subscriptions alive. Process a delivered message once, including unread/outbox.
      const messageIds = lifetimeRef.current.messageIds;
      if (messageIds.has(message.id)) return;
      messageIds.add(message.id);
      // Retain recent delivery IDs without growing for the entire workspace session.
      if (messageIds.size > 1000) messageIds.delete(messageIds.values().next().value!);
      const mine = message.sender.userId === selfIdRef.current;
      appendMessages(queryClient, pid, message.conversationId, [message]);
      if (mine) dispatch({ type: "outboxConsume", conversationId: message.conversationId, content: message.content, replyId: message.replyTo?.id });
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
    [queryClient],
  );

  /** Whatever happened while the socket was down is fetched over REST: no message is lost on a reconnect. */
  const handleConnect = useCallback((reconnect: boolean) => {
    const pid = projectIdRef.current;
    const lifetime = lifetimeRef.current;
    if (!lifetime.active || !pid) return;
    if (reconnect) void queryClient.invalidateQueries({ queryKey: chatKeys.overview(pid) });
    const loaded = queryClient.getQueriesData<MessagePages>({ queryKey: chatKeys.messagesRoot(pid) });
    void (async () => {
      for (const [key, data] of loaded) {
        const conversationId = key[4] as string;
        await syncReactions(conversationId);
        if (!lifetime.active || projectIdRef.current !== pid) return;
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
            if (!lifetime.active || projectIdRef.current !== pid) return;
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

  const connection = useChatSocket({ contextKey: projectId && selfId ? `${selfId}:${projectId}` : undefined, onEvent: handleEvent, onConnect: handleConnect });

  // ---- data --------------------------------------------------------------------------------------------------------
  const overviewQuery = useChatOverview(projectId, { poll: connection !== "connected" });
  const membersQuery = useChatMembers(projectId, shown);
  const openDirect = useOpenDirect(projectId);
  const markReadMutation = useMarkRead(projectId, ownerKey);
  const overview = overviewQuery.data;

  const active = state.active;
  const activePeerId = active?.kind === "direct" ? active.peerId : undefined;
  const activeConversationId =
    active === null
      ? undefined
      : active.kind === "group"
        ? overview?.group.id
        : (active.conversationId ?? overview?.directs.find((direct) => direct.peer?.userId === active.peerId)?.id);
  const activePeer = useMemo<ChatUser | null>(() => {
    if (!activePeerId) return null;
    const fromDirects = overview?.directs.find((direct) => direct.peer?.userId === activePeerId)?.peer;
    if (fromDirects) return fromDirects;
    return membersQuery.data?.find((member) => member.userId === activePeerId) ?? null;
  }, [activePeerId, overview, membersQuery.data]);

  useEffect(() => {
    if (shown && activeConversationId) void syncReactions(activeConversationId);
  }, [shown, activeConversationId, syncReactions, ownerKey]);

  // ---- panel state -------------------------------------------------------------------------------------------------
  const open = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) triggerRef.current = document.activeElement;
    dispatch({ type: "open" });
  }, []);
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

  const selectGroup = useCallback(() => dispatch({ type: "select", active: { kind: "group" } }), []);
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
          if (projectId) {
            void queryClient.invalidateQueries({ queryKey: chatKeys.overview(projectId) });
            void queryClient.invalidateQueries({ queryKey: chatKeys.members(projectId) });
          }
        },
        onError: (error) => {
          if (!lifetime.active) return;
          toast.error(te(errorKey(error)));
          dispatch({ type: "select", active: { kind: "group" } });
        },
      });
    },
    // `openDirect.mutate` is stable; `te` changes only with the locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openDirect.mutate, te, projectId, queryClient],
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
    const pid = projectIdRef.current, cid = activeConversationId, lifetime = lifetimeRef.current;
    const key = `${cid}:${messageId}:${code}`;
    if (!pid || !cid || !lifetime.active || pendingReactionsRef.current.has(key)) return;
    const pending = pendingReactionsRef.current;
    pending.add(key); setReactionPendingKeys(new Set(pending));
    try {
      const snapshot = await chatApi.react(pid, cid, messageId, code, add, lifetime.abort.signal);
      if (lifetime.active && projectIdRef.current === pid) applyReactionSnapshots(queryClient, pid, cid, [snapshot]);
    } catch (error) {
      if (lifetime.active) throw error;
    } finally {
      pending.delete(key);
      if (lifetime.active) setReactionPendingKeys(new Set(pending));
    }
  }, [activeConversationId, queryClient]);
  const reactionPending = useCallback((messageId: string, code: ReactionCode) => reactionPendingKeys.has(`${activeConversationId}:${messageId}:${code}`), [reactionPendingKeys, activeConversationId]);

  const deliver = useCallback(
    async (conversationId: string, clientId: string, content: string, reply?: ChatReply | null) => {
      const pid = projectIdRef.current;
      const lifetime = lifetimeRef.current;
      if (!lifetime.active || !pid) return;
      try {
        const message = await chatApi.send(pid, conversationId, content, reply?.id, lifetime.abort.signal);
        if (!lifetime.active || projectIdRef.current !== pid) return;
        appendMessages(queryClient, pid, conversationId, [message]);
        applyMessageToOverview(queryClient, pid, message, { mine: true, viewing: true });
        dispatch({ type: "outboxRemove", conversationId, clientId });
      } catch (error) {
        if (!lifetime.active || projectIdRef.current !== pid) return;
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
    (conversationId: string) => markReadMutation.mutate(conversationId),
    // `mutate` is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markReadMutation.mutate],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      projectId,
      contextSlug: slug,
      projectName,
      projectLogoSrc,
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
      outboxFor,
      send,
      retry,
      discard,
      reportView,
      markRead,
    }),
    // The query objects change identity every render; their data/status are what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      projectId, projectName, projectLogoSrc, slug, state.mode, active, activeConversationId, activePeer, connection, overview,
      overviewQuery.status, membersQuery.data, membersQuery.status, openDirect.isPending, open,
      minimize, expandCompact, expandFull, close, navigatePage, selectGroup, selectPeer, getDraft, setDraft, outboxFor, send,
      retry, discard, reportView, markRead, getReply, setReply, react, reactionPending,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
