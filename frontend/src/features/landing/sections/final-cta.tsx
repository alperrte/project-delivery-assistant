import { useTranslations } from "next-intl";
import { Reveal } from "../reveal";
import { CtaPair } from "./cta-pair";
import styles from "../landing.module.css";

export function FinalCta() {
  const t = useTranslations("landing");
  return (
    <section id="join" className={styles.final} aria-labelledby="final-heading">
      <div className={styles.finalInner}>
        <Reveal from="left"><h2 id="final-heading">{t("finalTitle")}</h2></Reveal>
        <Reveal from="right" delay={.1}><p>{t("finalBody")}</p><CtaPair /></Reveal>
      </div>
    </section>
  );
}
