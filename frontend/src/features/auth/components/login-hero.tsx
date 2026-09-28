import { Exo_2 } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

// The slogan's display face; loaded here so only the login page downloads it.
const exo2 = Exo_2({ subsets: ["latin", "latin-ext"], display: "swap" });

/**
 * Headline above the login card: plain ink, with a cyan highlight that
 * sweeps across it left to right (`auth-slogan` in globals.css).
 */
export async function LoginHero() {
  const t = await getTranslations("login.hero");
  return (
    <div className="mx-auto mb-[clamp(1.25rem,3.5vh,2.5rem)] max-w-4xl text-center">
      <h1
        className={cn(
          exo2.className,
          "auth-slogan text-balance text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.01em]",
        )}
      >
        {t("title")}
      </h1>
      <p className="auth-subtitle mx-auto mt-3 max-w-3xl text-pretty text-[clamp(1rem,1.3vw,1.125rem)] leading-relaxed text-(--auth-muted)">
        {t("subtitle")}
      </p>
    </div>
  );
}
