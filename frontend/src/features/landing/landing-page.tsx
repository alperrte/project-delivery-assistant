"use client";

import Link from "@/i18n/navigation";
import { useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { consumeHomeReturn } from "@/components/common/home-link";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { ProductStory } from "./product-story";
import { OpenSourceScene } from "./open-source-scene";
import styles from "./landing.module.css";

export function LandingPage() {
  const t = useTranslations("landing");
  const root = useRef<HTMLDivElement>(null);
  const returnRequested = useRef<boolean | null>(null);
  const reduce = useReducedMotionPreference();
  useLayoutEffect(() => {
    if (returnRequested.current === null) returnRequested.current = consumeHomeReturn();
    if (reduce) { returnRequested.current = false; return; }
    if (!returnRequested.current || !root.current) return;
    const animation = root.current.animate(
      [{ opacity: 0.3, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    animation.onfinish = () => { returnRequested.current = false; };
    return () => animation.cancel();
  }, [reduce]);

  return (
    <div ref={root} className={styles.landing}>
      <a href="#landing-main" className={styles.skip}>{t("skip")}</a>
      <header className={styles.header}>
        <Link href="/" aria-label="PDA · Project Delivery Assistant" className={styles.logo}>
          <Logo variant="wordmark" compact plain size={110} />
        </Link>
        <nav aria-label={t("navigation")} className={styles.controls}>
          <LocaleSwitcher hideLabelOnMobile triggerClassName="min-h-11" />
          <ThemeToggle />
          <Link href="/login" className={styles.headerLink}>{t("login")}</Link>
          <Link href="/register" className={cn(buttonVariants(), "auth-cta hover:brightness-110", styles.headerLogin)}>{t("register")}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
      </header>
      <main id="landing-main" tabIndex={-1}>
        <section className={styles.welcome} aria-labelledby="landing-heading">
          <p className={styles.eyebrow}>{t("welcome")}</p>
          <h1 id="landing-heading">{t("headlineFirst")}<br /><span>{t("headlineSecond")}</span></h1>
          <p className={styles.welcomeDescription}>{t("description")}</p>
          <a href="#product" className={styles.scrollHint}><span>{t("explore")}</span><ArrowDown size={18} aria-hidden="true" /></a>
          <p className={styles.welcomeFootnote} translate="no">PROJECT DELIVERY ASSISTANT</p>
        </section>
        <ProductStory />
        <OpenSourceScene />
        <section id="join" className={styles.final} aria-labelledby="final-heading">
          <p className={styles.eyebrow}>{t("finalLabel")}</p>
          <h2 id="final-heading">{t("finalFirst")}<br />{t("finalSecond")}<br /><span>{t("finalThird")}</span></h2>
          <p>{t("finalDescription")}</p>
          <div className={styles.actions}>
            <Link href="/register" className={cn(buttonVariants(), "auth-cta hover:brightness-110", styles.primary)}>{t("start")}<ArrowUpRight size={19} aria-hidden="true" /></Link>
            <Link href="/login" className={styles.textLink}>{t("login")}<ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <SiteFooter tone="auth" />
    </div>
  );
}
