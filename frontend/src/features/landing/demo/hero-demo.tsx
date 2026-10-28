"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AppShellView } from "@/components/layout/app-shell";
import { ChatProvider } from "@/features/chat/chat-provider";
import { BoardPage } from "@/features/tasks/components/board-page";
import { DEMO_USER } from "./demo-data";
import { DemoRoot } from "./demo-root";
import styles from "../landing.module.css";

const noop = () => {};

/** The real workspace (shell + task board) drawn at the visitor's own window width and scaled into the hero frame. */
export function HeroDemo() {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 560, scale: 1 });
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const width = Math.max(window.innerWidth, 360);
      const frameWidth = element.clientWidth, frameHeight = element.clientHeight;
      if (frameWidth <= 0 || frameHeight <= 0) return;
      const scale = frameWidth / width, height = Math.round(frameHeight / scale);
      setSize(current => current.width === width && current.height === height && current.scale === scale ? current : { width, height, scale });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  return <div ref={root} className={styles.heroViewport}>
    <div className={styles.heroCanvas} style={{ width: size.width || "100%", height: size.height, transform: "scale(" + size.scale + ")", "--demo-height": size.height + "px" } as CSSProperties}>
      <DemoRoot>{data => <ChatProvider disabled>
        <AppShellView contained pathname={"/projects/" + data.project.slug + "/tasks/board"} user={DEMO_USER} onLogout={noop} onToggleCollapsed={noop}>
          <BoardPage slug={data.project.slug} />
        </AppShellView>
      </ChatProvider>}</DemoRoot>
    </div>
  </div>;
}
