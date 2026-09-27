"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { SignOut } from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { authApi } from "@/features/auth/api";
import { sessionQueryKey, useSession } from "@/features/auth/hooks/use-session";

const NAV_LINKS = [
  { href: "/projects", key: "projects" },
  { href: "/organizations", key: "organizations" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app");
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError } = useSession();

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      router.replace("/login");
    }
  }

  if (isLoading || isError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/projects" className="flex items-center gap-2">
            <Logo variant="emblem" size={28} />
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  pathname.startsWith(link.href) && "bg-muted text-foreground",
                )}
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    {user?.nickname}
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="opacity-100">
                  {user?.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <SignOut data-icon="inline-start" size={16} />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
