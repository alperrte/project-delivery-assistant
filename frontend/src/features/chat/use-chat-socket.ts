"use client";

import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import { apiRequest, getAccessExpiresAt, renewAccessSession } from "@/lib/api/client";
import { chatSocketUrl } from "./api";
import type { ChatConnection, ChatSocketEvent } from "./types";

/** The only destination a client may subscribe to; the server resolves `/user` to this user's own sessions. */
const USER_QUEUE = "/user/queue/chat";

/** The session is renewed, and the socket with it, this long before the access token expires. */
const RENEW_LEAD_MS = 90_000;
/** Never sooner than this after the previous renewal, whatever the announced expiry says. */
const MIN_RENEW_DELAY_MS = 10_000;
/** Used when the server announced no expiry (an older backend). */
const FALLBACK_RENEW_AFTER_MS = 10 * 60_000;
/** A failed renewal is tried again after this. */
const RETRY_RENEW_MS = 20_000;
/** The old socket stays subscribed this long after the new one has taken over, so nothing falls between the two. */
const OVERLAP_MS = 3_000;

function parseEvent(body: string): ChatSocketEvent | null {
  try {
    const value = JSON.parse(body) as Partial<ChatSocketEvent> | null;
    if (!value || (value.type !== "MESSAGE" && value.type !== "READ")) return null;
    if (typeof value.projectId !== "string" || typeof value.conversationId !== "string") return null;
    return value as ChatSocketEvent;
  } catch {
    return null;
  }
}

/**
 * One STOMP-over-WebSocket client for each user/project context (`contextKey`); changing that context
 * disconnects it. The handshake carries the HttpOnly session cookie, so before every (re)connect a cheap `/auth/me`
 * call lets the API client renew an expired access cookie first. Reconnecting is the library's job
 * (`reconnectDelay`); `onConnect` fires after every successful connection (`reconnect` is true from the second one on)
 * so the caller can catch up on anything it missed in between over REST.
 *
 * The server ends a socket when the access token it was opened with expires. To keep the user from ever noticing,
 * the session is renewed shortly before that (the backend announces the expiry on every authenticated response) and
 * a second socket is opened with the new token. Only when that one is connected does it take over, and the old one
 * is closed a moment later (make before break), so there is no gap, no "disconnected" state and, because events are
 * deduplicated by message id, no double message.
 */
export function useChatSocket({
  contextKey,
  onEvent,
  onConnect,
}: {
  contextKey?: string;
  onEvent: (event: ChatSocketEvent) => void;
  onConnect: (reconnect: boolean) => void;
}): ChatConnection {
  const [state, setState] = useState<ChatConnection>("connecting");
  const onEventRef = useRef(onEvent);
  const onConnectRef = useRef(onConnect);

  useEffect(() => {
    onEventRef.current = onEvent;
    onConnectRef.current = onConnect;
  });

  useEffect(() => {
    if (!contextKey) return;
    let disposed = false;
    let connects = 0;
    /** What the user sees; mirrored into React state. */
    let shown: ChatConnection = "connecting";
    let active: Client | null = null;
    let renewTimer: ReturnType<typeof setTimeout> | undefined;
    const clients = new Set<Client>();
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const show = (next: ChatConnection) => {
      // Events of a socket that belongs to a project the user already left must not touch the state of the next one.
      if (disposed) return;
      shown = next;
      setState(next);
    };

    const scheduleRenewal = () => {
      clearTimeout(renewTimer);
      const expiresAt = getAccessExpiresAt();
      const delay =
        expiresAt === null
          ? FALLBACK_RENEW_AFTER_MS
          : Math.max(expiresAt - Date.now() - RENEW_LEAD_MS, MIN_RENEW_DELAY_MS);
      renewTimer = setTimeout(() => void renew(), delay);
    };

    const renew = async () => {
      if (disposed) return;
      const expiresAt = getAccessExpiresAt();
      if (expiresAt !== null && expiresAt - Date.now() > RENEW_LEAD_MS + MIN_RENEW_DELAY_MS) {
        // The session was renewed meanwhile by something else (a request that found the token expired, or another
        // tab): there is nothing to do yet. Look again when the newer expiry comes close.
        scheduleRenewal();
        return;
      }
      if (!(await renewAccessSession())) {
        // Offline, or the session is over (then the app shell sends the user to the login page). Try again soon; if
        // the token runs out meanwhile, the server closes the socket and the ordinary reconnect below takes over.
        if (!disposed) renewTimer = setTimeout(() => void renew(), RETRY_RENEW_MS);
        return;
      }
      if (!disposed) open(true);
    };

    /** Opens a socket. A renewal socket stays quiet to the user until it is connected, then replaces the active one. */
    const open = (renewal: boolean) => {
      const client: Client = new Client({
        brokerURL: chatSocketUrl(),
        reconnectDelay: 3000,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        // A half-open socket must be dropped so the reconnect timer can take over.
        discardWebsocketOnCommFailure: true,
        beforeConnect: async () => {
          if (disposed) { void client.deactivate({ force: true }); return; }
          if (!renewal || client === active) show("connecting");
          try {
            await apiRequest("/auth/me");
          } catch {
            // Offline or the session is over: the app shell handles the latter; a failed handshake retries later.
          }
          if (disposed) void client.deactivate({ force: true });
        },
        onConnect: () => {
          if (disposed) { void client.deactivate({ force: true }); return; }
          client.subscribe(USER_QUEUE, (frame) => {
            if (disposed) return;
            const event = parseEvent(frame.body);
            if (event) onEventRef.current(event);
          });
          const previous = active;
          const wasDown = shown !== "connected";
          active = client;
          if (previous && previous !== client) {
            // Hand over: the old socket keeps listening for a moment, then goes.
            const timer = setTimeout(() => {
              timers.delete(timer);
              clients.delete(previous);
              void previous.deactivate();
            }, OVERLAP_MS);
            timers.add(timer);
          }
          show("connected");
          // A swap with the old socket still healthy missed nothing; every other connection may have.
          if (!renewal || wasDown) onConnectRef.current(connects > 0);
          connects += 1;
          scheduleRenewal();
        },
        onWebSocketClose: () => {
          if (active === null || client === active) show("disconnected");
        },
        onStompError: () => {
          if (active === null || client === active) show("disconnected");
        },
      });
      clients.add(client);
      client.activate();
    };

    open(false);
    return () => {
      disposed = true;
      clearTimeout(renewTimer);
      timers.forEach(clearTimeout);
      clients.forEach((client) => void client.deactivate({ force: true }));
    };
  }, [contextKey]);

  return contextKey ? state : "disconnected";
}
