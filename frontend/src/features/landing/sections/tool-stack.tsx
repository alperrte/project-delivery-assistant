"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { GitBranch, ListChecks, MessageSquare, Video } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { useScrollScene } from "../use-landing-motion";
import styles from "../landing.module.css";

// Four unnamed tools: two arrive from the left, two from the right.
const TOOLS = [
  { key: "toolTask", icon: ListChecks, side: "left" },
  { key: "toolChat", icon: MessageSquare, side: "left" },
  { key: "toolMeeting", icon: Video, side: "right" },
  { key: "toolGit", icon: GitBranch, side: "right" },
] as const;

/** The problem in one picture: separate tools fly in from both sides and merge into PDA. */
export function ToolStack() {
  const t = useTranslations("landing");
  const root = useRef<HTMLElement>(null);

  useScrollScene(root, ({ gsap, ScrollTrigger, wide }, element) => {
    const pin = element.querySelector<HTMLElement>("[data-stack-pin]")!;
    const stage = element.querySelector<HTMLElement>("[data-stack-stage]")!;
    const chips = gsap.utils.toArray<HTMLElement>("[data-tool]", element);
    const core = element.querySelector<HTMLElement>("[data-stack-core]")!;
    const resolve = element.querySelector<HTMLElement>("[data-stack-resolve]")!;
    const direction = (chip: Element) => (chip as HTMLElement).dataset.tool === "left" ? -1 : 1;
    if (!wide) {
      gsap.from(chips, { autoAlpha: 0, y: 24, duration: .6, stagger: .12, ease: "power3.out", clearProps: "transform,opacity,visibility", scrollTrigger: { trigger: stage, start: "top 85%", once: true } });
      gsap.from([core, resolve], { autoAlpha: 0, y: 24, duration: .6, delay: .5, stagger: .12, ease: "power3.out", clearProps: "transform,opacity,visibility", scrollTrigger: { trigger: stage, start: "top 85%", once: true } });
      return;
    }
    const timeline = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: pin, start: "top top", end: "+=130%", pin: true, scrub: .6, anticipatePin: 1, refreshPriority: 1, invalidateOnRefresh: true } });
    timeline
      .from(chips, { autoAlpha: 0, x: (_, chip) => direction(chip) * window.innerWidth * .55, stagger: .08, duration: .4, ease: "power3.out" })
      .to(chips, { xPercent: (_, chip) => -direction(chip) * 135, scale: .35, autoAlpha: 0, stagger: .04, duration: .3, ease: "power2.in" }, "+=.25")
      .fromTo(core, { scale: 1 }, { scale: 1.14, duration: .2, ease: "power2.out" }, "<+.18")
      .from(resolve, { autoAlpha: 0, y: 18, duration: .2 }, "<+.1")
      .to(core, { scale: 1, duration: .15 });
    return () => { ScrollTrigger.refresh(); };
  });

  return (
    <section ref={root} className={styles.stack} aria-labelledby="stack-heading">
      <div className={styles.stackInner} data-stack-pin>
        <div className={styles.stackText}>
          <h2 id="stack-heading">{t("stackTitle")}</h2>
          <p>{t("stackBody")}</p>
        </div>
        <div className={styles.stackStage} data-stack-stage>
          <ul className={styles.tools}>
            {TOOLS.map(({ key, icon: Icon, side }) => <li key={key} className={styles.tool} data-tool={side}><Icon size={18} aria-hidden="true" />{t(key)}</li>)}
          </ul>
          <div className={styles.stackCore}>
            <div className={styles.stackLogo} data-stack-core aria-hidden="true"><Logo variant="wordmark" compact plain size={200} /></div>
            <p className={styles.stackResolve} data-stack-resolve>{t("stackResolve")}</p>
          </div>
        </div>
        <p className="sr-only">{t("stackSr")}</p>
      </div>
    </section>
  );
}
