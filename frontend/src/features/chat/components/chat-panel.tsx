"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Minus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useSidebarCollapsed } from "@/components/layout/sidebar-collapse";
import { cn } from "@/lib/utils";
import { useChat, draftKey } from "../chat-provider";
import { ActiveConversationIdentity, ConversationView } from "./conversation-view";
import { ConversationList } from "./conversation-list";

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True from the `md` breakpoint up, where the list and the conversation sit side by side. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/**
 * The full-size chat: it fills the main area to the right of the sidebar (`lg:left-60`, or `lg:left-16` while the
 * sidebar is collapsed) below the floating navbar, so the sidebar and navbar keep working. z-30 puts it above sticky
 * page bars (z-20) and below the navbar (z-40) and dialogs (z-50). On narrow screens it is one column: the list, or
 * the conversation with a back button.
 *
 * The minimize (-) button shrinks it to the bottom-right bar (Escape does the same); the close (x) button closes the
 * chat completely, without leaving a bar behind.
 */
export function ChatPanel() {
  const t = useTranslations("chat");
  const chat = useChat();
  const collapsed = useSidebarCollapsed();
  const panelRef = useRef<HTMLElement>(null);
  // On a narrow screen the list comes first; picking a conversation shows it.
  const [pane, setPane] = useState<"list" | "conversation">("list");
  const desktop = useIsDesktop();

  useEffect(() => {
    // Focus moves into the panel when it opens: on desktop the message box takes it, on a phone (where the list
    // comes first) the panel itself does.
    if (!window.matchMedia(DESKTOP_QUERY).matches) panelRef.current?.focus();
  }, []);

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      chat.minimize();
    }
  }

  const showConversation = pane === "conversation";
  const conversationKey = chat.active ? `${draftKey(chat.active)}:${chat.activeConversationId ?? ""}` : "none";

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label={t("panel.label")}
      data-testid="chat-panel"
      onKeyDown={keyDown}
      className={cn(
        "fixed inset-x-0 top-[4.5rem] bottom-0 z-30 flex min-h-0 flex-col border-t bg-background outline-none lg:border-l",
        collapsed ? "lg:left-16" : "lg:left-60",
      )}
    >
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b bg-card/70 px-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t("title")}</h2>
          {chat.projectName && <p className="truncate text-xs text-muted-foreground">{chat.projectName}</p>}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={t("panel.minimize")} data-testid="chat-minimize" onClick={chat.minimize}>
            <Minus size={16} aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("panel.close")} data-testid="chat-panel-close" onClick={chat.close}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className={cn("min-h-0 w-full shrink-0 flex-col border-r bg-surface-2/50 md:flex md:w-80 xl:w-88", showConversation ? "hidden" : "flex")}>
          <p className="px-4 pt-4 pb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {t("conversations")}
          </p>
          <ConversationList onSelected={() => setPane("conversation")} />
        </div>

        <div className={cn("min-h-0 min-w-0 flex-1 flex-col md:flex", showConversation ? "flex" : "hidden")}>
          <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/40 px-3 sm:px-5">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t("panel.back")} onClick={() => setPane("list")}>
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
            <ActiveConversationIdentity avatarClassName="size-9" />
          </div>
          {/* Not mounted behind the list on a phone: a hidden conversation must not count as read. */}
          {(desktop || showConversation) && <ConversationView key={conversationKey} autoFocus />}
        </div>
      </div>
    </section>
  );
}
