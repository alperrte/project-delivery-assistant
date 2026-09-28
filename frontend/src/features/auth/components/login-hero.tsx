import { getTranslations } from "next-intl/server";

/** Headline above the login card. The accent word carries the one gradient on the page. */
export async function LoginHero() {
  const t = await getTranslations("login.hero");
  return (
    <div className="mx-auto mb-[clamp(1.25rem,3.5vh,2.5rem)] max-w-4xl text-center">
      <h1
        className="font-[family-name:var(--font-exo2)] text-balance text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-[1.08] tracking-[-0.01em]"
      >
        {t.rich("title", {
          accent: (chunks) => (
            <span className="bg-linear-to-r from-(--auth-accent-from) to-(--auth-accent-to) bg-clip-text text-transparent">
              {chunks}
            </span>
          ),
        })}
      </h1>
      <p className="mx-auto mt-3 max-w-3xl text-pretty text-[clamp(1rem,1.3vw,1.125rem)] leading-relaxed text-(--auth-muted)">
        {t("subtitle")}
      </p>
    </div>
  );
}
