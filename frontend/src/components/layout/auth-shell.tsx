import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/common/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { cn } from "@/lib/utils";

// The two photos (both 1672×941) are separate renders of one scene: in the dark
// one everything sits ~4.5px right and ~39px higher. Each is moved half-way
// toward the other, in file pixels at the object-cover scale (times the
// enlargement, which applies first), and both are enlarged just enough that the
// moved edge never shows (20.7px of bleed per edge vs a 20.4px move);
// the scene no longer jumps on theme change. Served at quality 95 (see
// next.config.ts): the default 75 visibly softens the brushed-metal detail.
const BG_PX = "max(100vw / 1672, 100vh / 941)";
const BG_QUALITY = 95;
const BG_SCALE = 1.044;
const bgShift = (x: number, y: number) => ({
  transform: `translate(calc(${BG_PX} * ${x * BG_SCALE}), calc(${BG_PX} * ${y * BG_SCALE})) scale(${BG_SCALE})`,
});

const SCENES = [
  { src: "/images/background/bg-light.png", shift: bgShift(2.25, -19.5), theme: "dark:invisible" },
  { src: "/images/background/bg-dark.png", shift: bgShift(-2.25, 19.5), theme: "invisible dark:visible" },
] as const;

const NEON_FILTER_ID = "pda-scene-neon";

/**
 * One centred column over a full-bleed background photo (one per theme; CSS
 * shows the matching one; the other is only made invisible, so it keeps its
 * full-screen box, and both load eagerly so the first theme switch crossfades
 * into a ready image instead of an empty frame): wordmark on
 * top, then whatever the page brings (the login page adds its headline above
 * the card). Language and theme sit in the top corners, out of the reading line.
 *
 * Over each photo a light runs along its neon strips: the same image again,
 * filtered down to the strips (`NeonFilter`), is lit only where a soft band
 * passes (`auth-neon` in globals.css) and screened onto the photo.
 */
export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("brand");
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col bg-(--background) text-(--auth-ink)">
      <NeonFilter />
      <div aria-hidden className="auth-enter-scene pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {SCENES.map(({ src, shift, theme }) => (
          <div key={src} className={cn("absolute inset-0", theme)}>
            <Image
              src={src}
              alt=""
              fill
              sizes="100vw"
              quality={BG_QUALITY}
              loading="eager"
              className="object-cover"
              style={shift}
            />
            <div className="auth-neon">
              <Image
                src={src}
                alt=""
                fill
                sizes="100vw"
                quality={BG_QUALITY}
                loading="eager"
                className="object-cover"
                style={{ ...shift, filter: `url(#${NEON_FILTER_ID})` }}
              />
              <div className="auth-neon-band" />
            </div>
          </div>
        ))}
      </div>

      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-(--auth-cta) px-4 py-2 text-(--auth-cta-ink) focus:not-sr-only focus:absolute focus:left-4 focus:top-20"
      >
        {t("skip")}
      </a>

      <header className="auth-enter-controls absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6">
        <LocaleSwitcher triggerClassName="h-11 gap-2 rounded-full border border-(--auth-control-border) bg-(--auth-control) px-4 text-(--auth-ink) shadow-[0_6px_18px_-10px_rgb(15_23_42/0.35)] backdrop-blur-md hover:bg-(--auth-control) hover:text-(--auth-ink) aria-expanded:bg-(--auth-control) dark:hover:bg-(--auth-control)" />
        <ThemeToggle />
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full flex-1 max-w-5xl flex-col items-center px-4 pb-4 pt-20 sm:px-6 sm:pt-[clamp(3.5rem,6vh,6.5rem)]"
      >
        <Link
          href="/login"
          aria-label="PDA · Project Delivery Assistant"
          className="auth-enter-logo w-[clamp(13.5rem,min(30vw,24vh),27.5rem)] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-(--glow)"
        >
          <Logo variant="wordmark" size={440} priority />
        </Link>
        <div className="mt-4 w-full">{children}</div>
      </main>
      <SiteFooter tone="auth" />
    </div>
  );
}

/**
 * Keeps only the photos' neon strips: alpha = 4·(G/2 + B/2 − R) − 1.6 picks
 * saturated cyan and nothing else (not the pale light-theme sky, not the
 * chrome), and a blur adds the halo the moving light spills around them.
 */
function NeonFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id={NEON_FILTER_ID} colorInterpolationFilters="sRGB">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -4 2 2 0 -1.6"
          result="neon"
        />
        <feGaussianBlur in="neon" stdDeviation="5" result="halo" />
        <feMerge>
          <feMergeNode in="halo" />
          <feMergeNode in="halo" />
          <feMergeNode in="neon" />
        </feMerge>
      </filter>
    </svg>
  );
}
