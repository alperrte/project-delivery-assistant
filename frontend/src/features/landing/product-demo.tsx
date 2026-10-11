"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { HeadingLevelProvider } from "@/components/common/page-title";
import type { DemoStage } from "./demo/pda-demo-workspace";
export { DELIVERY_STATUSES } from "./demo/delivery-statuses";
import styles from "./landing.module.css";
const chapters = ["project", "team", "task", "delivery"] as const;

// The illustration is the real app workspace (shell, project, team and task screens): ~1 MB of script the page does not need
// to be readable. It is its own chunk, fetched only once the demo is near the viewport. It is decoration for sighted users
// (the viewport is aria-hidden; the chapter titles and descriptions beside it stay server-rendered), so no server render is
// needed. `.pdaViewport` has its size in CSS, so the empty box before the chunk arrives is already the final size.
const PdaDemoWorkspace = dynamic(() => import("./demo/pda-demo-workspace").then(module => module.PdaDemoWorkspace), { ssr: false });

function PdaViewport({ stage, progress, ready }: { stage: DemoStage; progress: number | null; ready: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 580, scale: 1 });
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const width = window.innerWidth;
      const viewportWidth = element.clientWidth;
      const viewportHeight = element.clientHeight;
      // Hidden or collapsing chapters can briefly have no usable content width.
      if (width <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return;
      const scale = viewportWidth / width;
      const height = Math.round(viewportHeight / scale);
      if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(height) || height <= 0) return;
      setDimensions(current => current.width === width && current.height === height && current.scale === scale ? current : { width, height, scale });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <div ref={root} className={styles.pdaViewport} data-pda-viewport={stage} role="img" aria-label="PDA">
    <div className={styles.pdaCanvas} style={{ width: dimensions.width || "100%", height: dimensions.height, transform: "scale(" + dimensions.scale + ")", "--demo-height": dimensions.height + "px" } as CSSProperties} aria-hidden="true">
      {ready && <HeadingLevelProvider level="h2"><PdaDemoWorkspace stage={stage} progress={progress} /></HeadingLevelProvider>}
    </div>
  </div>;
}

export function ProductDemo() {
  const t = useTranslations("landing");
  const [progress, setProgress] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  // One observer for all four chapters: on desktop only the current chapter is displayed, so the others have no box to observe,
  // and they must be ready the moment they are shown.
  useEffect(() => {
    const element = windowRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: "600px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = (event: Event) => setProgress((event as CustomEvent<number | null>).detail);
    window.addEventListener("pda:story-progress", update);
    return () => window.removeEventListener("pda:story-progress", update);
  }, []);
  return <div ref={windowRef} className={styles.demoWindow} data-demo-window><div className={styles.demoScenes}>
    {chapters.map((key, index) => <article id={"story-" + key} data-chapter={index} key={key} className={styles.chapter} aria-labelledby={"chapter-" + key}>
      <div className={styles.chapterHeading}><span className={styles.chapterNumber}>0{index + 1}</span><div><h3 id={"chapter-" + key}>{t(key + "Title")}</h3><p>{t(key + "Description")}</p></div></div>
      <PdaViewport stage={key} progress={progress} ready={ready} />
    </article>)}
  </div></div>;
}
