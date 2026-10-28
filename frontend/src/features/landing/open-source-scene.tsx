"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Minus, Square, Terminal, X } from "lucide-react";
import { GithubLogo } from "@phosphor-icons/react";
import { REPOSITORY_URL } from "@/features/public-info/site-info";
import { trackCta } from "@/features/analytics/cta";
import { commandSequence } from "./command-sequence";
import { advanceAnimationProgress } from "./animation-progress";
import { Reveal } from "./reveal";
import { useScrollScene } from "./use-landing-motion";
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
  const steps = commandSequence(t("envOutput"));

  // The typing is driven by scroll on large screens and plays once on entering below that. Without the scene the whole transcript stays visible.
  useScrollScene(root, ({ gsap, ScrollTrigger, wide }, element) => {
    const terminal = element.querySelector<HTMLElement>("[data-cmd-window]")!;
    const groups = Array.from(element.querySelectorAll<HTMLElement>("[data-command-group]"));
    const commands = groups.map(group => group.querySelector<HTMLElement>("[data-command]")!);
    const outputs = groups.map(group => group.querySelector<HTMLElement>("[data-output]")!);
    const cursors = groups.map(group => group.querySelector<HTMLElement>("[data-cursor]")!);
    const lengths = commands.map(node => (node.dataset.fullText ?? "").length);
    // A command gets character time plus a short, readable output hold.
    const durations = lengths.map(length => length + 24);
    const total = durations.reduce((sum, length) => sum + length, 0);
    const starts = durations.map((_, index) => durations.slice(0, index).reduce((sum, value) => sum + value, 0));
    const visible = wide ? 3 : 2;
    const progress = { value: advanceAnimationProgress(0) };
    const render = () => {
      const tick = progress.value * total;
      const active = progress.value >= 1 ? groups.length - 1 : starts.reduce((current, start, i) => tick >= start ? i : current, 0);
      groups.forEach((group, i) => {
        group.hidden = i > active || i < active - (visible - 1);
        const length = Math.max(0, Math.min(lengths[i], Math.floor(tick - starts[i])));
        const text = (commands[i].dataset.fullText ?? "").slice(0, length);
        if (commands[i].textContent !== text) commands[i].textContent = text;
        outputs[i].hidden = tick < starts[i] + lengths[i] + 3;
        cursors[i].hidden = progress.value >= 1 || i !== active;
      });
      element.dataset.command = String(active);
      element.dataset.ready = String(progress.value >= 1);
    };
    element.dataset.choreographed = "true";
    render();
    if (wide) {
      const update = (self: { progress: number }) => { progress.value = advanceAnimationProgress(self.progress); render(); };
      ScrollTrigger.create({ id: "landing-source", trigger: terminal, start: "top 75%", end: "top 20%", onUpdate: update, onRefresh: update });
    } else if (progress.value < 1) {
      const play = gsap.to(progress, { value: 1, duration: gsap.utils.clamp(4, 9, total / 30), ease: "none", paused: true, onUpdate: () => { advanceAnimationProgress(progress.value); render(); } });
      ScrollTrigger.create({ trigger: terminal, start: "top 80%", once: true, onEnter: () => { play.play(); } });
    }
    return () => {
      delete element.dataset.choreographed;
      delete element.dataset.command;
      delete element.dataset.ready;
      groups.forEach(group => { group.hidden = false; });
      commands.forEach(node => { node.textContent = node.dataset.fullText ?? ""; });
      outputs.forEach(output => { output.hidden = false; });
      cursors.forEach(cursor => { cursor.hidden = true; });
    };
  });

  return (
    <section id="open-source" ref={root} className={styles.openSource} aria-labelledby="source-heading">
      <div className={styles.sourceInner}>
        <div className={styles.sourceText}>
          <Reveal from="left">
            <p className={styles.eyebrow}>{t("sourceLabel")}<span translate="no">Apache 2.0</span></p>
            <h2 id="source-heading">{t("sourceTitle")}</h2>
            <p className={styles.sourceDescription}>{t("sourceDescription")}</p>
          </Reveal>
          <ul className={styles.techList}>{TECHNOLOGIES.map(tech => <li key={tech.name}><span className={styles.techIcon} style={{ maskImage: "url(/images/tech/" + tech.asset + ".svg)", maskMode: tech.asset === "nextjs" ? "luminance" : "alpha" }} aria-hidden="true" /><div><strong translate="no">{tech.name}</strong><span>{t(tech.role)}</span></div></li>)}</ul>
          <Reveal from="left" className={styles.contribute}>
            <h3>{t("contributeTitle")}</h3>
            <p>{t("contributeBody")}</p>
            <a href={REPOSITORY_URL} onClick={() => trackCta("github_repo")} className={styles.ghost}><GithubLogo size={20} aria-hidden="true" />{t("contributeCta")}</a>
          </Reveal>
        </div>
        <Reveal from="right" className={styles.sourceTerminal}>
          <figure className={styles.commandPrompt} data-cmd-window aria-label={t("terminalLabel")}>
            <div className={styles.cmdChrome}><span><Terminal size={16} aria-hidden="true" />Command Prompt</span><span className={styles.cmdControls} aria-hidden="true"><Minus size={15} /><Square size={12} /><X size={17} /></span></div>
            <div className={styles.cmdBody} aria-hidden="true"><p className={styles.cmdGreeting}>Microsoft Windows<br />(c) Microsoft Corporation.</p>
              {steps.map((step, index) => <div className={styles.commandGroup} data-command-group key={index}><p><span>{step.prompt}&gt;</span><span data-command data-full-text={step.command}>{step.command}</span><span data-cursor className={styles.cursor} hidden /></p><div data-output>{step.output.map((line, i) => <p key={i}>{line}</p>)}</div></div>)}
            </div>
            <figcaption className="sr-only"><pre>{steps.map(step => step.prompt + ">" + step.command + "\n" + step.output.join("\n")).join("\n\n")}</pre></figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
