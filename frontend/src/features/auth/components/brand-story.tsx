"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Kanban, ShieldCheck, UsersThree } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const SCENES = [
  { key: "track", Icon: Kanban },
  { key: "roles", Icon: UsersThree },
  { key: "secure", Icon: ShieldCheck },
] as const;

const SCENE_MS = 5200;

export function BrandStory() {
  const t = useTranslations("story");
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const { key, Icon } = SCENES[index];

  return (
    <section
      aria-label={t("welcome")}
      className="relative isolate flex h-full flex-col justify-between overflow-hidden bg-navy p-12 text-white xl:p-16"
    >
      <Backdrop />

      <div className="max-w-md">
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="text-4xl font-semibold leading-tight xl:text-5xl"
        >
          {t("welcome")}
        </motion.h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.12 }}
          className="mt-4 text-lg leading-relaxed text-white/70"
        >
          {t("intro")}
        </motion.p>
      </div>

      <div className="max-w-md">
        <div className="relative min-h-40" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={key}
              initial={reduce ? false : { opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? undefined : { opacity: 0, y: -16, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="mb-5 grid size-12 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Icon size={26} weight="duotone" className="text-brand-soft" />
              </span>
              <h2 className="text-2xl font-medium">{t(`scenes.${key}.title`)}</h2>
              <p className="mt-2 text-white/70">{t(`scenes.${key}.body`)}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex gap-2" role="tablist">
          {SCENES.map((scene, i) => (
            <button
              key={scene.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t(`scenes.${scene.key}.title`)}
              onClick={() => setIndex(i)}
              className="group py-2"
            >
              <span
                className={cn(
                  "block h-1 rounded-full transition-all duration-500",
                  i === index ? "w-10 bg-brand-soft" : "w-4 bg-white/25 group-hover:bg-white/45",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-brand/30 blur-3xl" />
      <div className="absolute -bottom-52 -left-32 size-[30rem] rounded-full bg-brand/20 blur-3xl" />
      {[26, 40, 56].map((rem, i) => (
        <div
          key={rem}
          className="absolute right-[-8rem] top-1/2 -translate-y-1/2 rounded-full border border-white/10"
          style={{ width: `${rem}rem`, height: `${rem}rem` }}
        >
          <span
            className="absolute inset-0 animate-orbit"
            style={{ animationDuration: `${24 + i * 12}s`, animationDirection: i % 2 ? "reverse" : "normal" }}
          >
            <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-soft shadow-[0_0_14px_var(--brand-soft)]" />
          </span>
        </div>
      ))}
    </div>
  );
}
