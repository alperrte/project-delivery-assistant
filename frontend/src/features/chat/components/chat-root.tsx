"use client";

import { useLayoutEffect } from "react";
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
  // Explicit X restores focus in the provider. Navigation must leave the next
  // page's focus alone; release inert before it can paint.
  useLayoutEffect(() => {
    if (!full) return;
    const main = document.getElementById("main-content");
    main?.setAttribute("inert", "");
    return () => main?.removeAttribute("inert");
  }, [full]);

  if (!projectId || mode === "closed") return null;
  return mode === "full" ? <ChatPanel /> : <ChatDock />;
}
