"use client";

import { useEffect, useRef } from "react";
import { useChat } from "../chat-provider";
import { ChatDock } from "./chat-dock";
import { ChatPanel } from "./chat-panel";

/**
 * Renders whichever of the chat's three visible states is current. While the full panel covers the page, the page
 * underneath is made inert, so keyboard focus and screen readers cannot wander into content the user cannot see.
 */
export function ChatRoot() {
  const { mode, projectId } = useChat();
  const full = !!projectId && mode === "full";
  const returnFocus = useRef<HTMLElement | null>(null);
  const previousMode = useRef(mode);

  useEffect(() => {
    if (mode === "full" && previousMode.current === "closed") {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (mode === "closed" && previousMode.current !== "closed") {
      const target = returnFocus.current;
      if (target?.isConnected) target.focus();
      returnFocus.current = null;
    }
    previousMode.current = mode;
  }, [mode]);

  useEffect(() => {
    if (!full) return;
    const main = document.getElementById("main-content");
    main?.setAttribute("inert", "");
    return () => main?.removeAttribute("inert");
  }, [full]);

  if (!projectId || mode === "closed") return null;
  return mode === "full" ? <ChatPanel /> : <ChatDock />;
}
