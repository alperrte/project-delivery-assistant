"use client";

import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Bell, CaretDown, EnvelopeSimple, List, SignOut } from "@phosphor-icons/react";
import { CONTACT_EMAIL, INFO_LINKS } from "@/features/public-info/site-info";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoUrl } from "@/features/account/api";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "./global-search";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { useAutoHide } from "./use-auto-hide";
import { WorkspaceHistoryControls } from "./workspace-history-controls";

type SessionUser = { id?: string; nickname?: string; email?: string; profilePhotoVersion?: number | null } | null | undefined;

/**
 * Glass navbar centered on the physical viewport, independent of sidebar
 * collapse. Below sm it uses two rows and the same responsive reserve as main
 * and fullscreen chat. History controls remain outside main's inert region.
 * useAutoHide preserves pointer, scroll, focus and search-shortcut behavior;
 * hiding the header never changes the space reserved for page content.
 */
export function AppHeader({
  user,
  onOpenMobileMenu,
  onLogout,
  contained = false,
}: {
  user: SessionUser;
  contained?: boolean;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}) {
  const t = useTranslations("app");
  const tw = useTranslations("workspace");
  const tf = useTranslations("siteFooter");
  const { ref, hidden, reveal } = useAutoHide<HTMLElement>(!contained);

  return (
    <div className="pointer-events-none fixed inset-x-3 top-0 z-40 sm:inset-x-auto sm:left-1/2 sm:w-[min(calc(100vw-1.5rem),620px)] sm:-translate-x-1/2 lg:w-[620px] xl:w-[700px] 2xl:w-[760px]">
      <button
        type="button"
        aria-hidden={!hidden}
        tabIndex={hidden ? 0 : -1}
        onPointerEnter={reveal}
        onFocus={reveal}
        onClick={reveal}
        className={cn(
          "pointer-events-auto absolute top-0 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-b-full bg-border transition-opacity duration-300",
          hidden ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <header
        ref={ref}
        className={cn(
          "pointer-events-auto relative top-3 flex h-28 w-full flex-col items-center gap-1 rounded-2xl border border-border/60 bg-background/95 px-3 py-2 shadow-[0_10px_30px_-14px_hsl(var(--shadow-tint)/0.35)] backdrop-saturate-150 transition-[translate,scale,opacity] duration-500 ease-out supports-[backdrop-filter]:bg-background/55 supports-[backdrop-filter]:backdrop-blur-2xl sm:h-12 sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:py-0",
          hidden && "pointer-events-none scale-95 -translate-y-[calc(100%+16px)] opacity-0",
        )}
      >
        <div className="flex h-11 w-full min-w-0 shrink-0 items-center gap-2 sm:contents">
        <Button variant="ghost" size="icon" className="shrink-0 max-sm:size-11 lg:hidden" aria-label={tw("navigation")} onClick={onOpenMobileMenu}>
          <List size={20} aria-hidden="true" />
        </Button>
        <WorkspaceHistoryControls enabled={!contained} />
        <GlobalSearch className="min-w-0 flex-1" keyboardShortcut={!contained} />
        </div>
        <div className="ml-auto flex h-11 min-w-0 shrink-0 items-center gap-1 sm:h-auto sm:gap-2">
          <LocaleSwitcher triggerClassName="max-sm:px-1" hideLabelOnMobile />
          <ThemeToggle />
          <NotificationsMenu />
          <div className="mx-1 h-5 border-l max-sm:hidden" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="max-w-44 min-w-0 gap-2 px-1 sm:px-2 xl:max-w-56">
                  <Avatar
                    name={user?.nickname ?? ""}
                    src={user?.id && user.profilePhotoVersion != null ? profilePhotoUrl(user.id, user.profilePhotoVersion) : null}
                    className="size-7 bg-primary text-[11px] text-primary-foreground ring-0"
                  />
                  <span className="hidden truncate sm:block" title={user?.nickname}>{user?.nickname}</span>
                  <CaretDown size={13} aria-hidden="true" />
                  <span className="sr-only">{tw("account")}</span>
                </Button>
              }
            />
            {/* The popup defaults to the trigger's width; the identity block needs room for a full e-mail. */}
            <DropdownMenuContent align="end" className="w-auto min-w-56 max-w-[min(20rem,calc(100vw-1.5rem))]">
              <div className="min-w-0 px-2.5 py-2">
                <p className="break-words text-sm font-medium text-foreground">{user?.nickname}</p>
                <p className="break-all text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/account" />}>{tw("accountSettings")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{tf("information")}</DropdownMenuLabel>
                {INFO_LINKS.map(({ key, href }) => (
                  <DropdownMenuItem key={key} className="min-h-11" render={<Link href={href} />}>{tf(key)}</DropdownMenuItem>
                ))}
                <DropdownMenuItem className="min-h-11" render={<a href={"mailto:" + CONTACT_EMAIL} />}>
                  <EnvelopeSimple data-icon="inline-start" size={16} aria-hidden="true" />
                  {tf("contact")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onLogout}>
                <SignOut data-icon="inline-start" size={16} aria-hidden="true" />
                {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
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
