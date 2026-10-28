"use client";

import { Fragment, useRef, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { LazyDemo } from "../demo/lazy-demo";
import { useScrollScene } from "../use-landing-motion";
import { CtaPair } from "./cta-pair";
import { cn } from "@/lib/utils";
import styles from "../landing.module.css";

const HeroDemo = dynamic(() => import("../demo/hero-demo").then(m => m.HeroDemo), { ssr: false });
const ROTATING = ["wordMeeting", "wordChat", "wordTask", "wordRepo"] as const;

/** Each word rises out of its own mask (CSS only, so the headline never depends on scripts). */
function Words({ text, from }: { text: string; from: number }) {
  return text.split(" ").map((word, index) => <Fragment key={index}>
    <span className={styles.word} style={{ "--i": from + index } as CSSProperties}><span>{word}</span></span>{" "}
  </Fragment>);
}

export function Hero() {
  const t = useTranslations("landing");
  const root = useRef<HTMLElement>(null);
  const words = ROTATING.map(key => t(key));

  // The preview starts tilted back and flattens while it scrolls to the middle of the screen.
  useScrollScene(root, ({ gsap, wide }, element) => {
    const frame = element.querySelector<HTMLElement>("[data-demo]");
    if (!wide || !frame) return;
    gsap.fromTo(frame, { rotationX: 10, scale: .94 }, {
      rotationX: 0, scale: 1, ease: "none",
      scrollTrigger: { trigger: frame.parentElement, start: "top 78%", end: "top 22%", scrub: true },
    });
  });

  return (
    <section ref={root} className={styles.hero} aria-labelledby="landing-heading">
      <div className={styles.heroText}>
        <p className={cn(styles.eyebrow, styles.rotatorLine)}>
          {t("rotatorLead")}{" "}
          <span className={styles.rotator} aria-hidden="true">{words.map((word, index) => <span key={word} style={{ "--i": index } as CSSProperties}>{word}</span>)}</span>
          <span className="sr-only">{words.join(", ")}</span>
        </p>
        <h1 id="landing-heading" className={styles.heroTitle}>
          <span className={styles.line}><Words text={t("heroLine1")} from={0} /></span>
          <span className={cn(styles.line, styles.accentLine)}><Words text={t("heroLine2")} from={t("heroLine1").split(" ").length} /></span>
        </h1>
        <p className={styles.heroDescription}>{t("heroDescription")}</p>
        <CtaPair />
      </div>
      <div className={styles.heroStage}>
        <LazyDemo description={t("heroPreviewLabel")} className={styles.heroFrame}><HeroDemo /></LazyDemo>
      </div>
    </section>
  );
}
