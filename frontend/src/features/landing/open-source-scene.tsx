"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Minus, Square, Terminal, X } from "lucide-react";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { REPOSITORY_URL } from "@/features/public-info/site-info";
import { trackCta } from "@/features/analytics/cta";
import { commandSequence } from "./command-sequence";
import { advanceAnimationProgress, releaseCompletedAnimation } from "./animation-progress";
import styles from "./landing.module.css";

const TECHNOLOGIES = [
  { name: "Spring Boot", asset: "spring", role: "springRole" },
  { name: "Next.js", asset: "nextjs", role: "nextRole" },
  { name: "PostgreSQL", asset: "postgresql", role: "postgresRole" },
  { name: "Docker", asset: "docker", role: "dockerRole" },
] as const;

export function OpenSourceScene() {
  const t = useTranslations("landing");
  const root = useRef<HTMLElement>(null);
  const reduce = useReducedMotionPreference();
  const steps = commandSequence(t("envOutput"));

  useEffect(() => {
    const element = root.current;
    if (!element || reduce) return;
    let disposed = false;
    let cleanup = () => {};
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      media.add("(min-width: 1024px) and (min-height: 800px)", () => {
        const groups = Array.from(element.querySelectorAll<HTMLElement>("[data-command-group]"));
        const commands = groups.map(group => group.querySelector<HTMLElement>("[data-command]")!);
        const outputs = groups.map(group => group.querySelector<HTMLElement>("[data-output]")!);
        const cursors = groups.map(group => group.querySelector<HTMLElement>("[data-cursor]")!);
        const lengths = commands.map(node => (node.dataset.fullText ?? "").length);
        // A command gets character time plus a short, readable output hold.
        const durations = lengths.map(length => length + 24);
        const total = durations.reduce((sum, length) => sum + length, 0);
        const starts = durations.map((_, index) => durations.slice(0, index).reduce((sum, value) => sum + value, 0));
        const facts = element.querySelectorAll<HTMLElement>("[data-fact]");
        gsap.set(facts, { autoAlpha: 0, y: 16 });
        const progress = { value: 0 };
        element.dataset.choreographed = "true";
        const render = () => {
          const tick = gsap.utils.clamp(0, 1, progress.value / 0.72) * total;
          const active = starts.reduce((current, start, i) => tick >= start ? i : current, 0);
          groups.forEach((group, i) => {
            group.hidden = i > active || i < active - 2;
            const length = Math.max(0, Math.min(lengths[i], Math.floor(tick - starts[i])));
            const text = (commands[i].dataset.fullText ?? "").slice(0, length);
            if (commands[i].textContent !== text) commands[i].textContent = text;
            outputs[i].hidden = tick < starts[i] + lengths[i] + 3;
            cursors[i].hidden = i !== active;
          });
          element.dataset.command = String(active);
          element.dataset.ready = String(progress.value >= 0.72);
        };
        const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });
        timeline.to(progress, { value: 1, duration: 100, onUpdate: render }, 0)
          .fromTo(element.querySelector("[data-cmd-window]"), { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 4 }, 0)
          .to(element.querySelector("[data-cmd-window]"), { scale: 0.74, xPercent: -29, duration: 10, ease: "power2.inOut" }, 74)
          .to(facts, { autoAlpha: 1, y: 0, stagger: 2, duration: 5 }, 83);
        const update = (scrollProgress: number) => timeline.progress(advanceAnimationProgress("source", scrollProgress));
        const trigger = ScrollTrigger.create({
          id: "landing-source", trigger: element, start: "top top", end: "bottom bottom",
          onUpdate: self => { update(self.progress); },
          onRefresh: self => { update(self.progress); },
        });
        update(trigger.progress);
        render();
        ScrollTrigger.refresh();
        const stopWatching = releaseCompletedAnimation("source", element, () => {
          trigger.kill();
          timeline.progress(1);
          cursors.forEach(cursor => { cursor.hidden = true; });
          requestAnimationFrame(() => { if (!disposed) ScrollTrigger.refresh(); });
        });
        return () => {
          stopWatching();
          delete element.dataset.choreographed;
          delete element.dataset.completed;
          delete element.dataset.command;
          delete element.dataset.ready;
          groups.forEach(group => { group.hidden = false; });
          commands.forEach(node => { node.textContent = node.dataset.fullText ?? ""; });
          outputs.forEach(output => { output.hidden = false; });
          cursors.forEach(cursor => { cursor.hidden = true; });
        };
      }, element);
      cleanup = () => media.revert();
    }).catch(() => { /* Keep the readable transcript and technology facts when animation is unavailable. */ });
    return () => { disposed = true; cleanup(); };
  }, [reduce, t]);

  return (
    <section id="open-source" ref={root} className={styles.openSource} aria-labelledby="source-heading">
      <div className={styles.sourceViewport}>
        <div className={styles.sourceIntro}><p className={styles.eyebrow}>{t("sourceLabel")}</p><h2 id="source-heading">{t("sourceTitle")}</h2><p>{t("sourceDescription")}</p></div>
        <div className={styles.sourceStage}>
          <figure className={styles.commandPrompt} data-cmd-window aria-label={t("terminalLabel")}>
            <div className={styles.cmdChrome}><span><Terminal size={16} aria-hidden="true" />Command Prompt</span><span className={styles.cmdControls} aria-hidden="true"><Minus size={15} /><Square size={12} /><X size={17} /></span></div>
            <div className={styles.cmdBody} aria-hidden="true"><p className={styles.cmdGreeting}>Microsoft Windows<br />(c) Microsoft Corporation.</p>
              {steps.map((step, index) => <div className={styles.commandGroup} data-command-group key={index}><p><span>{step.prompt}&gt;</span><span data-command data-full-text={step.command}>{step.command}</span><span data-cursor className={styles.cursor} hidden /></p><div data-output>{step.output.map((line, i) => <p key={i}>{line}</p>)}</div></div>)}
            </div>
            <figcaption className="sr-only"><pre>{steps.map(step => step.prompt + ">" + step.command + "\n" + step.output.join("\n")).join("\n\n")}</pre></figcaption>
          </figure>
          <div className={styles.sourceFacts}>
            <div data-fact><p className={styles.factBrand} translate="no">PDA</p><p className={styles.factLicense}>{t("openSource")} <span>Apache 2.0</span></p></div>
            <h3 data-fact>{t("sourceFact")}</h3>
            <ul className={styles.techList}>{TECHNOLOGIES.map(tech => <li data-fact key={tech.name}><span className={styles.techIcon} style={{ maskImage: "url(/images/tech/" + tech.asset + ".svg)", maskMode: tech.asset === "nextjs" ? "luminance" : "alpha" }} aria-hidden="true" /><div><strong translate="no">{tech.name}</strong><span>{t(tech.role)}</span></div></li>)}</ul>
            <a data-fact href={REPOSITORY_URL} onClick={() => trackCta("github_repo")} className={styles.sourceLink}>{t("source")}<ArrowUpRight size={18} aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </section>
  );
}
