import type { ReactNode } from "react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { BrandStory } from "@/features/auth/components/brand-story";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="hidden lg:block">
        <BrandStory />
      </div>

      <main className="relative flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-end gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="-mt-2 mb-4 flex justify-center">
            <Logo variant="full" size={280} priority />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
