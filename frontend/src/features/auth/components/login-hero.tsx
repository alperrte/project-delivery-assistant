import type { CSSProperties } from "react";
import { Exo_2 } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

// The slogan's display face; loaded here so only the login page downloads it.
const exo2 = Exo_2({ subsets: ["latin", "latin-ext"], display: "swap" });

/**
 * Headline above the login card: plain ink, with an electric current that
 * runs around each letter in turn, from the first to the last, then makes
 * the whole line flash before resting (`auth-slogan` in globals.css). Each
 * letter is its own span carrying its position (`--i`); words stay unbroken.
 * Per-letter spans would be read out letter by letter, so they are hidden
 * from assistive tech and the sentence is given once as screen-reader text.
 */
export async function LoginHero() {
  const t = await getTranslations("login.hero");
  const title = t("title");

  let count = 0;
  const words = title.split(" ").map((word) => Array.from(word, (ch) => ({ ch, i: count++ })));

  return (
    <div className="mx-auto mb-[clamp(1.25rem,3.5vh,2.5rem)] max-w-4xl text-center">
      <h1
        className={cn(
          exo2.className,
          "auth-slogan text-balance text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.01em]",
        )}
        style={{ "--n": count } as CSSProperties}
      >
        <span className="sr-only">{title}</span>
        <span aria-hidden>
          {words.map((letters, w) => (
            <span key={w}>
              {w > 0 && " "}
              <span className="whitespace-nowrap">
                {letters.map(({ ch, i }) => (
                  <span key={i} className="slogan-ch" data-ch={ch} style={{ "--i": i } as CSSProperties}>
                    {ch}
                  </span>
                ))}
              </span>
            </span>
          ))}
        </span>
      </h1>
      <p className="auth-subtitle mx-auto mt-3 max-w-3xl text-pretty text-[clamp(1rem,1.3vw,1.125rem)] leading-relaxed text-(--auth-muted)">
        {t("subtitle")}
      </p>
    </div>
  );
}
