"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Minus, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useSidebarCollapsed } from "@/components/layout/sidebar-collapse";
import { useSidebarWidth } from "@/components/layout/sidebar-width";
import { cn } from "@/lib/utils";
import { useChat, draftKey } from "../chat-provider";
import { ActiveConversationIdentity, ConversationView } from "./conversation-view";
import { ConversationSearchButton, type ConversationHandle } from "./conversation-search";
import { ConversationList } from "./conversation-list";

const DESKTOP_QUERY = "(min-width: 768px)";
const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 560;
const MIN_CONVERSATION_VIEW_WIDTH = 320;
const SIDEBAR_STORAGE_KEY = "pda:chat:sidebar-width";

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
 * The conversations list width on desktop is dynamically resizable via drag handle or keyboard, with local storage
 * persistence and double-click reset to default width.
 *
 * The minimize (-) button shrinks it to the bottom-right bar (Escape does the same); the close (x) button closes the
 * chat completely, without leaving a bar behind.
 */
export function ChatPanel() {
  const t = useTranslations("chat");
  const chat = useChat();
  const collapsed = useSidebarCollapsed();
  const workspaceSidebar = useSidebarWidth();
  const panelRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<ConversationHandle>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  // On a narrow screen the list comes first; picking a conversation shows it.
  const [pane, setPane] = useState<"list" | "conversation">("list");
  const desktop = useIsDesktop();

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored) {
        const parsed = Number.parseInt(stored, 10);
        if (!Number.isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    // Focus moves into the panel when it opens: on desktop the message box takes it, on a phone (where the list
    // comes first) the panel itself does.
    if (!window.matchMedia(DESKTOP_QUERY).matches) panelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isResizing]);

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (!event.defaultPrevented && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f"
        && chat.activeConversationId && (event.target as HTMLElement).closest("[data-chat-active]")) {
      event.preventDefault(); conversationRef.current?.openSearch();
    }
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      chat.minimize();
    }
  }

  const setAndSaveWidth = (nextWidth: number) => {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, nextWidth));
    setSidebarWidth(clamped);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const rawWidth = event.clientX - rect.left;
    const maxAllowed = Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, rect.width - MIN_CONVERSATION_VIEW_WIDTH),
    );
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, Math.round(rawWidth)));
    setSidebarWidth(clamped);
  };

  const onHandlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isResizing) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    setIsResizing(false);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth));
    } catch {
      // ignore
    }
  };

  const onHandleDoubleClick = () => {
    setAndSaveWidth(DEFAULT_SIDEBAR_WIDTH);
  };

  const onHandleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setAndSaveWidth(sidebarWidth - 16);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setAndSaveWidth(sidebarWidth + 16);
    } else if (event.key === "Home") {
      event.preventDefault();
      setAndSaveWidth(MIN_SIDEBAR_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      setAndSaveWidth(MAX_SIDEBAR_WIDTH);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setAndSaveWidth(DEFAULT_SIDEBAR_WIDTH);
    }
  };

  const showConversation = pane === "conversation";
  const conversationKey = chat.active ? `${draftKey(chat.active)}:${chat.activeConversationId ?? ""}` : "none";

  return (
    <section
      ref={panelRef}
      style={{ "--workspace-sidebar-width": collapsed ? "64px" : `${workspaceSidebar.width}px` } as import("react").CSSProperties}
      tabIndex={-1}
      aria-label={t("panel.label")}
      data-testid="chat-panel"
      onKeyDown={keyDown}
      className={cn(
        "fixed inset-x-0 top-(--workspace-header-reserve) bottom-0 z-30 flex min-h-0 flex-col border-t bg-background outline-none lg:border-l",
        "lg:left-(--workspace-sidebar-width)",
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

      <div ref={containerRef} className="flex min-h-0 flex-1">
        <div
          style={desktop ? { width: `${sidebarWidth}px` } : undefined}
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-r bg-surface-2/50 md:flex",
            showConversation ? "hidden" : "flex",
          )}
        >
          <p className="px-4 pt-4 pb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {t("conversations")}
          </p>
          <ConversationList onSelected={() => setPane("conversation")} />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("panel.resize")}
          aria-valuenow={sidebarWidth}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          tabIndex={0}
          title={t("panel.resizeHint")}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onDoubleClick={onHandleDoubleClick}
          onKeyDown={onHandleKeyDown}
          className={cn(
            "group relative hidden md:flex w-2.5 -ml-[5px] cursor-col-resize select-none touch-none items-center justify-center z-10 outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
            isResizing && "bg-primary/10",
          )}
        >
          <div
            className={cn(
              "absolute top-[calc(50dvh-var(--workspace-header-reserve)-3.5rem-1px)] h-8 w-1 -translate-y-1/2 rounded-full bg-border transition-[height,width,background-color] duration-150 motion-reduce:transition-none group-hover:h-12 group-hover:bg-primary group-hover:w-1.5",
              isResizing && "h-14 bg-primary w-1.5",
            )}
            aria-hidden="true"
          />
        </div>

        <div data-chat-active="" className={cn("min-h-0 min-w-0 flex-1 flex-col md:flex", showConversation ? "flex" : "hidden")}>
          <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/40 px-3 sm:px-5">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t("panel.back")} onClick={() => setPane("list")}>
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
            <ActiveConversationIdentity avatarClassName="size-9" />
            <div className="ml-auto"><ConversationSearchButton triggerRef={searchTriggerRef} disabled={!chat.activeConversationId} onClick={() => conversationRef.current?.openSearch()} /></div>
          </div>
          {/* Not mounted behind the list on a phone: a hidden conversation must not count as read. */}
          {(desktop || showConversation) && <ConversationView key={conversationKey} ref={conversationRef} searchTriggerRef={searchTriggerRef} autoFocus />}
        </div>
      </div>
    </section>
  );
}
