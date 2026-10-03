"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductStory } from "./product-story";
import { OpenSourceScene } from "./open-source-scene";
import { LandingFooter } from "./landing-footer";
import styles from "./landing.module.css";

export function LandingPage() {
  const t = useTranslations("landing");
  return (
    <div className={styles.landing}>
      <a href="#landing-main" className={styles.skip}>{t("skip")}</a>
      <header className={styles.header}>
        <Link href="/" aria-label="PDA · Project Delivery Assistant" className={styles.logo}>
          <Logo variant="wordmark" compact plain size={110} priority />
        </Link>
        <nav aria-label={t("navigation")} className={styles.nav}>
          <a href="#product">{t("product")}</a><a href="#open-source">{t("openSource")}</a>
        </nav>
        <div className={styles.controls}>
          <LocaleSwitcher hideLabelOnMobile triggerClassName="min-h-11" />
          <ThemeToggle tone="auth" />
          <Link href="/login" className={styles.headerLogin}>{t("login")}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
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
            <Link href="/register" className={cn(buttonVariants(), styles.primary)}>{t("start")}<ArrowUpRight size={19} aria-hidden="true" /></Link>
            <Link href="/login" className={styles.textLink}>{t("login")}<ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
