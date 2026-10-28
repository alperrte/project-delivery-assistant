"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play } from "lucide-react";
import styles from "../landing.module.css";

const ITEMS = ["marqueeNotifications", "marqueeCommits", "marqueeBoard", "marqueeCalendar", "marqueeGuests", "marqueeLanguages"] as const;

/** The only continuous motion on the page: a slow line of small extras. The second copy is decoration; the button stops it, and with reduced motion the line stops and wraps. */
export function Marquee() {
  const t = useTranslations("landing");
  const [paused, setPaused] = useState(false);
  return (
    <section className={styles.marquee} data-paused={paused} aria-label={t("marqueeLabel")}>
      <ul className={styles.marqueeTrack}>
        {[0, 1].map(copy => ITEMS.map(key => <li key={copy + key} aria-hidden={copy ? true : undefined} translate={key === "marqueeLanguages" ? "no" : undefined}>{t(key)}</li>))}
      </ul>
      <button type="button" className={styles.marqueeToggle} aria-pressed={paused} aria-label={t(paused ? "marqueePlay" : "marqueePause")} onClick={() => setPaused(value => !value)}>
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>
    </section>
  );
}
