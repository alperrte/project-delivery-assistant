"use client";

import Link from "@/i18n/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { consumeHomeReturn } from "@/components/common/home-link";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { TrackedLink } from "@/features/analytics/tracked-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { ProductStory } from "./product-story";
import { OpenSourceScene } from "./open-source-scene";
import styles from "./landing.module.css";

export function LandingPage() {
  const t = useTranslations("landing");
  const footer = useTranslations("siteFooter");
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const returnRequested = useRef<boolean | null>(null);
  const reduce = useReducedMotionPreference();
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      // Nested language menus consume their own Escape first.
      if (event.key !== "Escape" || event.defaultPrevented || !(event.target instanceof Node) || !header.current?.contains(event.target)) return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);
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
      <header ref={header} className={styles.header}>
        <Link href="/" aria-label="PDA · Project Delivery Assistant" className={styles.logo}>
          <Logo variant="wordmark" compact plain size={110} />
        </Link>
        <button ref={menuButton} type="button" className={styles.menuButton} aria-label={t("navigation")} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(open => !open)}>
          {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
        <nav id="landing-navigation" aria-label={t("navigation")} className={styles.controls} data-open={menuOpen} onClick={event => { if ((event.target as HTMLElement).closest("a[href]")) setMenuOpen(false); }}>
          <div className={styles.preferences}>
            <LocaleSwitcher triggerClassName={cn("min-h-11", styles.languageTrigger)} />
            <ThemeToggle />
          </div>
          <Link href="/about" className={styles.headerLink}>{footer("about")}</Link>
          <Link href="/contact" className={styles.headerLink}>{footer("contact")}</Link>
          <TrackedLink ctaId="header_login" href="/login" className={styles.headerLink}>{t("login")}</TrackedLink>
          <TrackedLink ctaId="header_register" href="/register" className={cn(buttonVariants(), "auth-cta text-(--auth-cta-ink) hover:brightness-110", styles.headerLogin)}>{t("register")}<ArrowUpRight size={15} aria-hidden="true" /></TrackedLink>
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
            <TrackedLink ctaId="landing_register" href="/register" className={cn(buttonVariants(), "auth-cta text-(--auth-cta-ink) hover:brightness-110", styles.primary)}>{t("start")}<ArrowUpRight size={19} aria-hidden="true" /></TrackedLink>
            <TrackedLink ctaId="landing_login" href="/login" className={styles.textLink}>{t("login")}<ArrowUpRight size={17} aria-hidden="true" /></TrackedLink>
          </div>
        </section>
      </main>
      <SiteFooter tone="auth" />
    </div>
  );
}
