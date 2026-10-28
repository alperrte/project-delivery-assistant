"use client";

import Link from "@/i18n/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { consumeHomeReturn } from "@/components/common/home-link";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SiteFooter } from "@/components/layout/site-footer";
import { TrackedLink } from "@/features/analytics/tracked-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { OpenSourceScene } from "./open-source-scene";
import { useRevealScene } from "./reveal";
import { Hero } from "./sections/hero";
import { ToolStack } from "./sections/tool-stack";
import { ChatFeature, MeetingFeature, OrganizationFeature, RepositoryFeature, TaskFeature } from "./sections/features";
import { Marquee } from "./sections/marquee";
import { FinalCta } from "./sections/final-cta";
import styles from "./landing.module.css";

const SECTIONS = ["features", "open-source"] as const;

export function LandingPage() {
  const t = useTranslations("landing");
  const footer = useTranslations("siteFooter");
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, setSection] = useState<(typeof SECTIONS)[number] | null>(null);
  const returnRequested = useRef<boolean | null>(null);
  const reduce = useReducedMotionPreference();
  useRevealScene(root);
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
  // The bar turns translucent once the page moves; a data attribute avoids re-rendering on every scroll.
  useEffect(() => {
    const update = () => { if (header.current) header.current.dataset.scrolled = String(window.scrollY > 8); };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  // The anchor of the section crossing the middle of the screen is marked as the current location.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) visible.add(entry.target.id); else visible.delete(entry.target.id); });
      setSection(SECTIONS.find(id => visible.has(id)) ?? null);
    }, { rootMargin: "-45% 0px -45% 0px" });
    SECTIONS.forEach(id => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, []);
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
      <header ref={header} className={styles.header} data-scrolled="false">
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
          <a href="#features" className={styles.headerLink} aria-current={section === "features" ? "location" : undefined}>{t("navFeatures")}</a>
          <a href="#open-source" className={styles.headerLink} aria-current={section === "open-source" ? "location" : undefined}>{t("openSource")}</a>
          <Link href="/about" className={styles.headerLink}>{footer("about")}</Link>
          <Link href="/contact" className={styles.headerLink}>{footer("contact")}</Link>
          <TrackedLink ctaId="header_login" href="/login" className={styles.headerLink}>{t("login")}</TrackedLink>
          <TrackedLink ctaId="header_register" href="/register" className={cn(buttonVariants(), "auth-cta text-(--auth-cta-ink) hover:brightness-110", styles.headerLogin)}>{t("register")}<ArrowUpRight size={15} aria-hidden="true" /></TrackedLink>
        </nav>
      </header>
      <main id="landing-main" tabIndex={-1}>
        <Hero />
        <ToolStack />
        <div id="features">
          <MeetingFeature />
          <ChatFeature />
          <TaskFeature />
          <RepositoryFeature />
          <OrganizationFeature />
          <Marquee />
        </div>
        <OpenSourceScene />
        <FinalCta />
      </main>
      <SiteFooter tone="auth" />
    </div>
  );
}
