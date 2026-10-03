"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { PdaDemoWorkspace, type DemoStage } from "./demo/pda-demo-workspace";
export { DELIVERY_STATUSES } from "./demo/pda-demo-workspace";
import styles from "./landing.module.css";
const chapters = ["project", "team", "task", "delivery"] as const;

function PdaViewport({ stage, progress }: { stage: DemoStage; progress: number | null }) {
  const root = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 580, scale: 1 });
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const width = window.innerWidth;
      const scale = element.clientWidth / width;
      setDimensions({ width, height: Math.round(element.clientHeight / scale), scale });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <div ref={root} className={styles.pdaViewport} data-pda-viewport={stage} role="img" aria-label="PDA">
    <div className={styles.pdaCanvas} style={{ width: dimensions.width || "100%", height: dimensions.height, transform: "scale(" + dimensions.scale + ")", "--demo-height": dimensions.height + "px" } as CSSProperties} aria-hidden="true">
      <PdaDemoWorkspace stage={stage} progress={progress} />
    </div>
  </div>;
}

export function ProductDemo() {
  const t = useTranslations("landing");
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => {
    const update = (event: Event) => setProgress((event as CustomEvent<number | null>).detail);
    window.addEventListener("pda:story-progress", update);
    return () => window.removeEventListener("pda:story-progress", update);
  }, []);
  return <div className={styles.demoWindow} data-demo-window><div className={styles.demoScenes}>
    {chapters.map((key, index) => <article id={"story-" + key} data-chapter={index} key={key} className={styles.chapter} aria-labelledby={"chapter-" + key}>
      <div className={styles.chapterHeading}><span className={styles.chapterNumber}>0{index + 1}</span><div><h3 id={"chapter-" + key}>{t(key + "Title")}</h3><p>{t(key + "Description")}</p></div></div>
      <PdaViewport stage={key} progress={progress} />
    </article>)}
  </div></div>;
}
