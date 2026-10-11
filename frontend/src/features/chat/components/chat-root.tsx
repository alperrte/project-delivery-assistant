"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect } from "react";
import { useChat } from "../chat-provider";

// The dock and the full panel (message list, composer, member picker, emoji/reaction UI) are only needed once a chat is
// opened, which is a user action after the page has loaded; their code is fetched then instead of with every workspace page.
// Client-only is fine: both start closed, so there is nothing to server-render.
const ChatDock = dynamic(() => import("./chat-dock").then(module => module.ChatDock), { ssr: false });
const ChatPanel = dynamic(() => import("./chat-panel").then(module => module.ChatPanel), { ssr: false });

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
