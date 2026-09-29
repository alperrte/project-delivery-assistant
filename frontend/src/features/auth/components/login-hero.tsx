import { getTranslations } from "next-intl/server";

/**
 * Headline above the login card: plain ink, with a glossy light sheen that
 * glides over it from left to right every few seconds (`auth-slogan` in
 * globals.css). The sheen is drawn from `data-text`, which is left out of the
 * accessible name, so the heading still reads as one plain sentence.
 */
export async function LoginHero() {
  const t = await getTranslations("login.hero");
  const title = t("title");

  return (
    <div className="mx-auto mb-[clamp(1.25rem,3.5vh,2.5rem)] max-w-4xl text-center">
      <h1
        className="font-[family-name:var(--font-exo2)] text-balance text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.01em]"
        data-text={title}
        className={cn(
          exo2.className,
          "auth-slogan text-balance text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.01em]",
        )}
      >
        {title}
      </h1>
      <p className="auth-subtitle mx-auto mt-3 max-w-3xl text-pretty text-[clamp(1rem,1.3vw,1.125rem)] leading-relaxed text-(--auth-muted)">
        {t("subtitle")}
      </p>
    </div>
  );
}
