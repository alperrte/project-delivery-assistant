"use client";

import type { ComponentProps } from "react";
import Link from "@/i18n/navigation";
import { useOptionalChat } from "@/features/chat/chat-provider";

/** Only accepted, same-tab workspace navigation closes the full chat. */
export default function WorkspaceLink({ onNavigate, ...props }: ComponentProps<typeof Link>) {
  const chat = useOptionalChat();
  return <Link {...props} onNavigate={(event) => {
    let cancelled = false;
    onNavigate?.({ preventDefault: () => { cancelled = true; event.preventDefault(); } });
    if (!cancelled) chat?.navigatePage();
  }} />;
}
