import type { ReactNode, Ref } from "react";

/** Primary action inside an AuthCard: the dark chrome bar (cyan in dark mode). */
export const authCtaClass =
  "auth-cta group/cta h-12 rounded-[0.7rem] text-[0.95rem] font-semibold hover:brightness-110 focus-visible:ring-(--glow)/50";

/**
 * The single framed surface on the auth screens: frosted over the chrome
 * scene, with a bright top edge. Entrance motion is CSS keyed off the (auth)
 * template's `data-entrance`; the card animates itself rather than a wrapper,
 * because an ancestor's opacity or filter would cut its backdrop blur off
 * from the scene.
 */
export function AuthCard({
  title,
  subtitle,
  headingLevel = 1,
  eyebrow,
  headingRef,
  children,
}: {
  title: string;
  subtitle: string;
  /** 2 when the page already has its own h1 above the card (login). */
  headingLevel?: 1 | 2;
  /** Small label above the heading (the administrator sign-in names its area here). */
  eyebrow?: ReactNode;
  /** Lets a multi-step card move focus to the heading when the step changes (the heading becomes programmatically focusable). */
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section
      aria-labelledby="auth-card-title"
      className="auth-scope auth-card-surface relative mx-auto w-full max-w-[30rem] rounded-[1.25rem] border border-(--auth-card-edge) bg-(--auth-card) p-6 text-(--auth-ink) shadow-(--auth-card-shadow) ring-1 ring-(--auth-card-ring) backdrop-blur-xl sm:p-9"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-white to-transparent dark:via-(--glow)/50"
      />
      <div className="mb-7">
        {eyebrow}
        <Heading
          id="auth-card-title"
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="text-[1.6rem] font-bold leading-tight tracking-tight outline-none"
        >
          {title}
        </Heading>
        <p className="mt-2 text-sm leading-relaxed text-(--auth-muted)">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
