"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CONTACT_EMAIL, INFO_LINKS, REPOSITORY_URL } from "@/features/public-info/site-info";
import styles from "./landing.module.css";

export function LandingFooter() {
  const t = useTranslations("landing");
  const info = useTranslations("siteFooter");
  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}><div><p className={styles.footerBrand} translate="no">PDA <span>Project Delivery Assistant</span></p><p>{t("footerDescription")}</p></div>
        <nav aria-label={t("openSource")}><a href={REPOSITORY_URL + "/blob/main/README.md"}>{t("docs")}</a><a href={REPOSITORY_URL}>GitHub</a></nav>
      </div>
      <div className={styles.footerBottom}><p>{t("copyright", { year: 2026 })} · <a href={REPOSITORY_URL + "/blob/main/LICENSE"}>{t("license")}</a></p><nav aria-label={t("information")}>{INFO_LINKS.map(link => <Link key={link.key} href={link.href}>{info(link.key)}</Link>)}<a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a></nav></div>
    </footer>
  );
}
