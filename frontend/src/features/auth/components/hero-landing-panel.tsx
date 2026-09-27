"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { CircleHalf, GitBranch, ShieldCheck, Translate } from "@phosphor-icons/react";
import { ProductPreview } from "./product-preview";
import { ValuePillars } from "./value-pillars";

const TRUST = [
  { key: "languages", Icon: Translate },
  { key: "themes", Icon: CircleHalf },
  { key: "session", Icon: ShieldCheck },
  { key: "open", Icon: GitBranch },
] as const;

/**
 * Landing half of the login screen. Always dark (the `dark` class scopes the
 * tokens), layered: navy base, a soft light from the upper left, an almost
 * invisible grid and one blurred accent behind the preview.
 */
export function HeroLandingPanel() {
  const t = useTranslations("story");
  const reduce = useReducedMotion();
  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay },
  });

  return (
    <section className="dark relative isolate flex h-full overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_0%_0%,rgb(79_140_255/0.16),transparent_60%),linear-gradient(180deg,#0b1730_0%,#07111f_55%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_30%_30%,#000,transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute -right-24 bottom-16 -z-10 hidden size-[26rem] rounded-full bg-primary/15 blur-3xl lg:block"
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col justify-center gap-7 px-6 py-12 sm:px-10 lg:max-w-none lg:px-14 xl:px-20">
        <div className="space-y-5">
          <motion.p
            {...enter(0)}
            className="inline-flex w-fit items-center rounded-md border bg-card/60 px-2.5 py-1 text-xs font-medium text-muted-foreground"
          >
            {t("badge")}
          </motion.p>
          <motion.h1
            {...enter(0.05)}
            className="max-w-2xl text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl xl:text-5xl"
          >
            {t("headline")}
          </motion.h1>
          <motion.p {...enter(0.1)} className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
            {t("intro")}
          </motion.p>
        </div>

        <motion.div {...enter(0.15)}>
          <ValuePillars />
        </motion.div>

        <motion.div {...enter(0.2)} className="pt-2">
          <ProductPreview />
        </motion.div>

        <motion.ul
          {...enter(0.25)}
          className="hidden flex-wrap gap-x-6 gap-y-2 border-t pt-5 text-xs text-muted-foreground sm:flex"
        >
          {TRUST.map(({ key, Icon }) => (
            <li key={key} className="flex items-center gap-1.5">
              <Icon size={14} aria-hidden />
              {t(`trust.${key}`)}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
