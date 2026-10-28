import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { GithubLogo } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { TrackedLink } from "@/features/analytics/tracked-link";
import { trackCta } from "@/features/analytics/cta";
import { REPOSITORY_URL } from "@/features/public-info/site-info";
import { cn } from "@/lib/utils";
import styles from "../landing.module.css";

/** Register is the one primary action; the repository is a quiet outlined link beside it. */
export function CtaPair() {
  const t = useTranslations("landing");
  return (
    <div className={styles.actions}>
      <TrackedLink ctaId="landing_register" href="/register" className={cn(buttonVariants(), "auth-cta text-(--auth-cta-ink) hover:brightness-110", styles.primary)}>{t("register")}<ArrowUpRight size={19} aria-hidden="true" /></TrackedLink>
      <a href={REPOSITORY_URL} onClick={() => trackCta("github_repo")} className={styles.ghost}><GithubLogo size={20} aria-hidden="true" />{t("source")}</a>
    </div>
  );
}
