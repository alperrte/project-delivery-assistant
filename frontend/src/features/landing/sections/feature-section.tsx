import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "../reveal";
import styles from "../landing.module.css";

/**
 * One product feature: a numbered title block and its demo. `split` puts them side by side (text on `side`),
 * `stack` gives a wide demo the full width below the text. The text slides in from its own side, the demo from the opposite one.
 */
export function FeatureSection({ id, number, title, body, side = "left", layout = "split", demo, children }: {
  id: string; number: string; title: string; body: string; side?: "left" | "right"; layout?: "split" | "stack"; demo: ReactNode; children?: ReactNode;
}) {
  return (
    <section id={id} className={styles.feature} data-side={side} data-layout={layout} aria-labelledby={id + "-title"}>
      <div className={styles.featureGrid}>
        <Reveal from={side} className={styles.featureText}>
          <p className={styles.number} aria-hidden="true">{number}</p>
          <h2 id={id + "-title"}>{title}</h2>
          <p className={styles.featureBody}>{body}</p>
          {children}
        </Reveal>
        <Reveal from={layout === "stack" ? "up" : side === "left" ? "right" : "left"} delay={.12} className={cn(styles.featureDemo)}>{demo}</Reveal>
      </div>
    </section>
  );
}
