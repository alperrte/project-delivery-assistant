"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell, CaretDown, List, SignOut } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { useAutoHide } from "./use-auto-hide";

type SessionUser = { nickname?: string; email?: string } | null | undefined;

/**
 * Floating glass navbar: a compact pill fixed to the true viewport (so it's
 * centered on the physical screen, not the content column next to the
 * sidebar), blurred, and driven by `useAutoHide` so it slides away when the
 * user isn't interacting with it and comes back on a cursor-to-top,
 * scroll-up, focus, or Ctrl/Cmd+K. Width steps up at each breakpoint
 * (`lg`/`xl`/`2xl`) using the sidebar's widest (expanded, 240px) state as the
 * clearance floor, so the pill never overlaps it. A thin handle stays visible
 * at the top center while hidden so the behavior is discoverable, not just
 * implicit. `main` compensates with `pt-[4.5rem]` in `app-shell.tsx` so
 * resting content is never tucked under it.
 */
export function AppHeader({
  user,
  onOpenMobileMenu,
  onLogout,
}: {
  user: SessionUser;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}) {
  const t = useTranslations("app");
  const tw = useTranslations("workspace");
  const { ref, hidden, reveal } = useAutoHide<HTMLElement>();

  return (
    <>
      <button
        type="button"
        aria-hidden={!hidden}
        tabIndex={hidden ? 0 : -1}
        onPointerEnter={reveal}
        onFocus={reveal}
        onClick={reveal}
        className={cn(
          "fixed inset-x-0 top-0 z-30 mx-auto h-1.5 w-10 rounded-b-full bg-border transition-opacity duration-300",
          hidden ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <header
        ref={ref}
        className={cn(
          "fixed inset-x-3 top-3 z-40 flex h-12 items-center gap-2 rounded-full border border-border/60 bg-background/95 px-3 shadow-[0_10px_30px_-14px_hsl(var(--shadow-tint)/0.35)] backdrop-saturate-150 transition-[translate,scale,opacity] duration-500 ease-out supports-[backdrop-filter]:bg-background/55 supports-[backdrop-filter]:backdrop-blur-2xl sm:inset-x-auto sm:left-1/2 sm:w-[min(90vw,560px)] sm:-translate-x-1/2 sm:px-4 lg:w-[440px] xl:w-[620px] 2xl:w-[760px]",
          hidden && "pointer-events-none scale-95 -translate-y-[calc(100%+16px)] opacity-0",
        )}
      >
        <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label={tw("navigation")} onClick={onOpenMobileMenu}>
          <List size={20} aria-hidden="true" />
        </Button>
        <GlobalSearch className="min-w-0 flex-1" />
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          <LocaleSwitcher triggerClassName="max-sm:px-1" hideLabelOnMobile />
          <ThemeToggle tone="app" />
          <NotificationsMenu />
          <div className="mx-1 h-5 border-l max-sm:hidden" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="max-w-40 min-w-0 gap-2 px-1 sm:px-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {user?.nickname?.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden truncate sm:block">{user?.nickname}</span>
                  <CaretDown size={13} aria-hidden="true" />
                  <span className="sr-only">{tw("account")}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled className="opacity-100">{user?.email}</DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/account" />}>{tw("settings")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onLogout}>
                <SignOut data-icon="inline-start" size={16} aria-hidden="true" />
                {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}

/** Bell icon in the navbar; backend wiring lands later, so the panel only ever shows an empty state for now. */
function NotificationsMenu() {
  const t = useTranslations("workspace");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("notifications")}
        render={
          <Button variant="ghost" size="icon">
            <Bell size={18} aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-56">
        <p className="px-2 py-2 text-sm text-muted-foreground">{t("noNotifications")}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
