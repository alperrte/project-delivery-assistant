"use client";

import { useEffect, useState, type ReactNode, type ComponentProps } from "react";
import Link from "@/i18n/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Buildings, SquaresFour, House, GearSix, CalendarBlank, SidebarSimple, EnvelopeSimple } from "@phosphor-icons/react";
import { AppHeader } from "./app-header";
import { ProjectSidebarNav } from "./project-sidebar-nav";
import { TasksNavLink } from "./tasks-nav-link";
import { COLLAPSE_KEY, collapseEvent, useSidebarCollapsed } from "./sidebar-collapse";
import { ChatProvider } from "@/features/chat/chat-provider";
import { ChatRoot } from "@/features/chat/components/chat-root";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/common/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { navItemClass } from "./nav-item";
import { cn } from "@/lib/utils";
import { authApi } from "@/features/auth/api";
import { ApiError, SESSION_EXPIRED_EVENT } from "@/lib/api/client";
import { PageFailure } from "@/features/errors/page-failure";
import { ErrorFrame } from "@/features/errors/error-frame";
import { sessionQueryKey, useSession } from "@/features/auth/hooks/use-session";
import { useApplySavedPreferences, useRestoreSessionBaseline } from "@/features/settings/session-preferences";

const NAV_LINKS = [
  { href: "/dashboard", key: "home", icon: House },
  { href: "/projects", key: "projects", icon: SquaresFour },
  { href: "/organizations", key: "organizations", icon: Buildings },
  { href: "/invitations", key: "invitations", icon: EnvelopeSimple },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError, error, refetch } = useSession();
  const sessionExpired = isError && error instanceof ApiError && error.status === 401;
  // A sign-in starts with the account's saved defaults; the navbar's language and theme switches only last until
  // sign-out (or the end of the session), when the interface goes back to where the sign-in started.
  useApplySavedPreferences(user?.id);
  const restoreBaseline = useRestoreSessionBaseline();
  // SSR/first-paint snapshot is always "expanded" so hydration never mismatches;
  // the real preference (if collapsed) applies a frame later, same pattern as
  // the last-selected-project memory in project-sidebar-nav.tsx.
  const collapsed = useSidebarCollapsed();

  useEffect(() => {
    if (!sessionExpired) return;
    restoreBaseline();
    router.replace("/login");
    // `restoreBaseline` is recreated every render; the session ending is the only trigger that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpired, router]);

  // The access token is renewed transparently; this only fires when the session itself is over.
  useEffect(() => {
    const sessionEnded = () => {
      restoreBaseline();
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      router.replace("/login");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, sessionEnded);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, sessionEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, router]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      restoreBaseline();
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      router.replace("/login");
    }
  }

  function toggleCollapsed() {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      // Private browsing / disabled storage: the toggle still works for this
      // tab via the dispatched event below, it just won't persist.
    }
    window.dispatchEvent(new Event(collapseEvent));
  }

  if (isError && !sessionExpired) {
    return <ErrorFrame><PageFailure error={error} onRetry={() => { void refetch(); }} /></ErrorFrame>;
  }

  if (isLoading || sessionExpired) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return <ChatProvider><AppShellView pathname={pathname} user={user} collapsed={collapsed} onLogout={handleLogout} onToggleCollapsed={toggleCollapsed}>{children}</AppShellView><ChatRoot /></ChatProvider>;
}

/** Shared workspace presentation; authentication and API state stay in AppShell. */
export function AppShellView({ children, pathname, user, collapsed = false, onLogout, onToggleCollapsed, contained = false }: {
  children: ReactNode;
  pathname: string;
  user: ComponentProps<typeof AppHeader>["user"];
  collapsed?: boolean;
  onLogout: () => void;
  onToggleCollapsed: () => void;
  contained?: boolean;
}) {
  const t = useTranslations("app");
  const tw = useTranslations("workspace");
  const [menuOpen, setMenuOpen] = useState(false);
  function renderNavigation(narrow: boolean) {
    return (
      <>
        <Link
          href="/dashboard"
          onClick={() => setMenuOpen(false)}
          className={cn("flex h-16 shrink-0 items-center justify-center", narrow ? "px-2" : "px-6")}
          aria-label="PDA"
        >
          {narrow ? <Logo variant="emblem" size={28} priority={!contained} /> : <Logo variant="wordmark" compact plain size={140} priority={!contained} />}
        </Link>
        <nav aria-label={tw("navigation")} className={cn("min-h-0 flex-1 space-y-1 overflow-y-auto py-3", narrow ? "px-2" : "px-3")}>
          {NAV_LINKS.map(link => {
            const Icon = link.icon;
            // Inside one project the selected-project group owns the highlight, so "Projeler" lights up only on
            // the list and the create page; organizations also own their detail pages.
            const active = link.key === "organizations"
              ? pathname.startsWith(link.href)
              : link.key === "projects"
                ? pathname === link.href || pathname === "/projects/new"
                : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                title={narrow ? t(`nav.${link.key}`) : undefined}
                aria-label={narrow ? t(`nav.${link.key}`) : undefined}
                aria-current={active ? "page" : undefined}
                className={navItemClass(active, cn("flex items-center gap-3 rounded-md py-2.5 text-[13px] font-medium hover:bg-muted hover:text-foreground", narrow ? "justify-center px-0" : "px-3"))}
              >
                <Icon size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />
                {!narrow && t(`nav.${link.key}`)}
              </Link>
            );
          })}
          <ProjectSidebarNav pathnameOverride={pathname} onNavigate={() => setMenuOpen(false)} collapsed={narrow} />
          <div className="mt-3 border-t border-border pt-4">
            {!narrow && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{tw("personal")}</p>
            )}
          </div>
          <TasksNavLink narrow={narrow} onNavigate={() => setMenuOpen(false)} />
          <Link
            href="/calendar"
            onClick={() => setMenuOpen(false)}
            title={narrow ? tw("calendar") : undefined}
            aria-label={narrow ? tw("calendar") : undefined}
            aria-current={pathname === "/calendar" ? "page" : undefined}
            className={navItemClass(pathname === "/calendar", cn("flex items-center gap-3 rounded-md py-2.5 text-[13px] hover:bg-muted hover:text-foreground", narrow ? "justify-center px-0" : "px-3"))}
          >
            <CalendarBlank size={19} weight={pathname === "/calendar" ? "fill" : "regular"} aria-hidden="true" />
            {!narrow && tw("calendar")}
          </Link>
        </nav>
        <div className={cn("space-y-3 p-3", narrow && "px-2")}>
          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            title={narrow ? tw("settings") : undefined}
            aria-label={narrow ? tw("settings") : undefined}
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={navItemClass(pathname === "/settings", cn("flex items-center gap-3 rounded-md py-2 text-[13px] hover:bg-muted hover:text-foreground", narrow ? "justify-center px-0" : "px-3"))}
          >
            <GearSix size={19} aria-hidden="true" />
            {!narrow && tw("settings")}
          </Link>
        </div>
      </>
    );
  }

  const shell = (
    <div style={contained ? { height: "var(--demo-height)" } : undefined} className={cn("flex bg-background", contained ? "workspace-preview min-h-full" : "app-shell min-h-[100dvh]")}>
      {!contained && <a href="#main-content" className="sr-only z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">{tw("skip")}</a>}
      <aside style={contained ? { height: "var(--demo-height)" } : undefined} className={cn("sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r bg-surface-2 transition-[width] duration-300 lg:flex", collapsed ? "w-16" : "w-60")}>
        {renderNavigation(collapsed)}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? tw("expandSidebar") : tw("collapseSidebar")}
          aria-label={collapsed ? tw("expandSidebar") : tw("collapseSidebar")}
          className={cn(
            "flex items-center gap-2 border-t border-border py-2.5 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground",
            collapsed ? "justify-center px-2" : "justify-center px-3",
          )}
        >
          <SidebarSimple size={16} aria-hidden="true" weight={collapsed ? "fill" : "regular"} />
          {!collapsed && tw("collapseSidebar")}
        </button>
      </aside>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="top-0 left-0 h-[100dvh] max-h-[100dvh] w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:max-w-72">
          <DialogTitle className="sr-only">{tw("navigation")}</DialogTitle>
          <div className="flex min-h-0 flex-col overflow-y-auto">{renderNavigation(false)}</div>
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader contained={contained} user={user} onOpenMobileMenu={() => setMenuOpen(true)} onLogout={onLogout} />
        <main id={contained ? undefined : "main-content"} style={contained ? { height: "var(--demo-height)", overflowY: "auto" } : undefined} tabIndex={-1} className={cn("w-full min-w-0 flex-1 pt-[4.5rem]", pathname === "/dashboard" ? "" : "mx-auto max-w-[1560px] px-4 pb-6 sm:px-8 sm:pb-8")}>{children}</main>
      </div>
    </div>
  );

  return shell;
}
