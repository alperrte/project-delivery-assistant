"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown, ArrowUpRight, CheckCircle, GitBranch, Target, UsersThree } from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { GitHubIcon } from "@/components/common/brand-icons";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { REPOSITORY_URL } from "@/features/public-info/site-info";
import { cn } from "@/lib/utils";
import styles from "./landing.module.css";

const views = ["overview", "criteria"] as const;
const subscribeToMount = () => () => {};
const features = [
  { key: "projects", icon: Target },
  { key: "team", icon: UsersThree },
  { key: "work", icon: GitBranch },
] as const;

export function LandingPage() {
  const t = useTranslations("landing");
  const [view, setView] = useState<(typeof views)[number]>("overview");
  const reduce = useReducedMotion();
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);
  const preview = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: preview, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [8, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.96, 1]);
  const primary = cn(buttonVariants(), styles.primary);

  return (
    <div className={styles.landing}>
      <a href="#landing-main" className={styles.skip}>{t("skip")}</a>
      <header className={styles.header}>
        <Link href="/" aria-label="PDA · Project Delivery Assistant" className={styles.logo}>
          <Logo variant="wordmark" compact plain size={100} priority />
        </Link>
        <nav aria-label={t("navigation")} className={styles.nav}>
          <a href="#product">{t("product")}</a><a href="#features">{t("features")}</a><Link href="/faq">{t("faq")}</Link>
        </nav>
        <div className={styles.controls}>
          <LocaleSwitcher hideLabelOnMobile triggerClassName="min-h-11 rounded-full" />
          <ThemeToggle tone="app" className="[&_button]:size-11" />
          <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), styles.login)}>{t("login")}</Link>
        </div>
      </header>
      <main id="landing-main" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="landing-heading">
          <div className={styles.atmosphere} aria-hidden="true" />
          <div className={styles.heroIntro}>
            <p className={styles.intro}><span translate="no">Project Delivery Assistant</span><span>{t("audience")}</span></p>
            <h1 id="landing-heading">{t("headlineFirst")}<br />{t("headlineSecond")}</h1>
            <div className={styles.heroBottom}>
              <p className={styles.description}>{t("description")}</p>
              <div className={styles.actions}>
                <Link href="/register" className={primary}>{t("start")}<ArrowUpRight size={20} aria-hidden="true" /></Link>
                <a href="#product" className={styles.textLink}>{t("explore")}<ArrowDown size={17} aria-hidden="true" /></a>
              </div>
            </div>
          </div>
          <div id="product" ref={preview} className={styles.product}>
            <div className={styles.previewHeading}>
              <p>{t("previewIntro")}</p>
              <div className={styles.viewPicker} role="group" aria-label={t("views")}>
                {views.map(option => <button key={option} type="button" aria-pressed={view === option} aria-controls="product-preview" onClick={() => setView(option)}>{t(option)}</button>)}
              </div>
            </div>
            <motion.figure id="product-preview" className={styles.preview} style={mounted && !reduce ? { rotateX, scale } : undefined}>
              <div className={styles.windowBar} aria-hidden="true"><span className={styles.windowDots}><i /><i /><i /></span><span>PDA / {t(view)}</span><span><CheckCircle size={15} /></span></div>
              <div className={styles.screen}>
                {views.map(option => <div key={option} hidden={view !== option}>
                  <Image src={`/images/landing/project-${option}-light-v1.webp`} width={1440} height={900} alt={t(`${option}Alt`)} sizes="(max-width: 1280px) 94vw, 1200px" priority={option === "overview"} className="block h-auto w-full dark:hidden" />
                  <Image src={`/images/landing/project-${option}-dark-v1.webp`} width={1440} height={900} alt={t(`${option}Alt`)} sizes="(max-width: 1280px) 94vw, 1200px" priority={option === "overview"} className="hidden h-auto w-full dark:block" />
                </div>)}
              </div>
              <figcaption>{t("previewCaption")}</figcaption>
            </motion.figure>
          </div>
        </section>
        <section id="features" className={styles.features} aria-labelledby="features-heading">
          <div className={styles.sectionHeading}><h2 id="features-heading">{t("featuresTitle")}</h2><p>{t("featuresDescription")}</p></div>
          <div className={styles.featureList}>
            {features.map(({ key, icon: Icon }) => <article key={key} className={styles.feature}>
              <Icon size={29} weight="duotone" aria-hidden="true" /><h3>{t(`${key}Title`)}</h3><p>{t(`${key}Description`)}</p>
              <ul>{["First", "Second"].map(item => <li key={item}><CheckCircle size={16} aria-hidden="true" />{t(`${key}${item}`)}</li>)}</ul>
            </article>)}
          </div>
        </section>
        <section className={styles.getStarted} aria-labelledby="steps-heading">
          <div className={styles.sectionHeading}><h2 id="steps-heading">{t("stepsTitle")}</h2><p>{t("stepsDescription")}</p></div>
          <ol className={styles.steps}>
            {["account", "project", "invite"].map((step, index) => <li key={step}><span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><h3>{t(`${step}Title`)}</h3><p>{t(`${step}Description`)}</p></li>)}
          </ol>
        </section>
        <section className={styles.closing} aria-labelledby="closing-heading">
          <div><h2 id="closing-heading">{t("closingTitle")}</h2><p>{t("closingDescription")}</p></div>
          <div className={styles.closingActions}><Link href="/register" className={primary}>{t("start")}<ArrowUpRight size={20} aria-hidden="true" /></Link><a href={REPOSITORY_URL} className={styles.textLink}><GitHubIcon className="size-5" />{t("source")}</a></div>
        </section>
      </main>
      <SiteFooter tone="landing" />
    </div>
  );
}
