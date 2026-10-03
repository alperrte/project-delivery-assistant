"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { useDeviceReducesMotion, useReducedMotionPreference } from "@/lib/preferences/motion";
import { ProductDemo, DELIVERY_STATUSES } from "./product-demo";
import styles from "./landing.module.css";

const CHAPTERS = ["project", "team", "task", "delivery"] as const;
const CHAPTER_STARTS = [0, 0.25, 0.46, 0.69];
const CHAPTER_TARGETS = [0.09, 0.34, 0.57, 0.96];

export function ProductStory() {
  const t = useTranslations("landing");
  const root = useRef<HTMLElement>(null);
  const scrollRange = useRef<{ start: number; end: number } | null>(null);
  const reducePreference = useReducedMotionPreference();
  const reduceDevice = useDeviceReducesMotion();
  const reduce = reducePreference || reduceDevice;

  useEffect(() => {
    const element = root.current;
    if (!element || reduce) return;
    let disposed = false;
    let cleanup = () => {};
    // The static, complete story is the default. Enhance only spacious desktop viewports.
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      media.add("(min-width: 1024px) and (min-height: 800px)", () => {
        const chapters = Array.from(element.querySelectorAll<HTMLElement>("[data-chapter]"));
        const links = Array.from(element.querySelectorAll<HTMLAnchorElement>("[data-chapter-link]"));
        const progress = { value: 0 };
        let chapter = -1;
        element.dataset.choreographed = "true";
        const render = () => {
          const p = progress.value;
          const next = CHAPTER_STARTS.reduce((active, start, index) => p >= start ? index : active, 0);
          if (next !== chapter) {
            chapter = next;
            chapters.forEach((panel, i) => { panel.hidden = i !== next; });
            links.forEach((link, i) => { if (i === next) link.setAttribute("aria-current", "step"); else link.removeAttribute("aria-current"); });
            element.dataset.chapter = CHAPTERS[next];
          }
          const statusIndex = Math.min(4, Math.max(0, Math.floor((p - 0.69) / 0.055)));
          element.dataset.taskStatus = DELIVERY_STATUSES[statusIndex];
          window.dispatchEvent(new CustomEvent("pda:story-progress", { detail: p }));
        };
        const timeline = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: {
          id: "landing-product", trigger: element, start: "top top", end: "bottom bottom", scrub: true,
          invalidateOnRefresh: true, onRefresh: self => { scrollRange.current = { start: self.start, end: self.end }; },
        }});
        timeline.to(progress, { value: 1, duration: 100, onUpdate: render }, 0)
          .fromTo(element.querySelector("[data-progress]"), { scaleX: 0 }, { scaleX: 1, duration: 100 }, 0)
          .to(element.querySelector("[data-demo-window]"), { opacity: 0.3, y: -18, scale: 0.98, duration: 3 }, 97);
        render();
        ScrollTrigger.refresh();
        return () => {
          delete element.dataset.choreographed;
          delete element.dataset.chapter;
          delete element.dataset.taskStatus;
          scrollRange.current = null;
          chapters.forEach(panel => { panel.hidden = false; });
          links.forEach(link => link.removeAttribute("aria-current"));
          window.dispatchEvent(new CustomEvent("pda:story-progress", { detail: null }));
        };
      }, element);
      cleanup = () => media.revert();
    }).catch(() => { /* The complete static story remains usable if the animation chunk fails. */ });
    return () => { disposed = true; cleanup(); };
  }, [reduce]);

  function jump(event: MouseEvent<HTMLAnchorElement>, index: number) {
    const range = scrollRange.current;
    if (!range) return;
    event.preventDefault();
    window.scrollTo({ top: range.start + (range.end - range.start) * CHAPTER_TARGETS[index], behavior: "instant" });
  }

  return (
    <section id="product" ref={root} className={styles.productStory} aria-labelledby="story-heading">
      <div className={styles.storyViewport}>
        <div className={styles.storyIntro}><div><p className={styles.eyebrow}>{t("storyLabel")}</p><h2 id="story-heading">{t("storyTitle")}</h2></div><p>{t("storyDescription")}</p></div>
        <nav className={styles.chapterNav} aria-label={t("chapters")}>{CHAPTERS.map((key, i) => <a data-chapter-link href={"#story-" + key} onClick={event => jump(event, i)} key={key}><span>0{i + 1}</span>{t(key + "Step")}</a>)}</nav>
        <ProductDemo />
        <div className={styles.storyTrack} aria-hidden="true"><span data-progress /></div>
      </div>
    </section>
  );
}
