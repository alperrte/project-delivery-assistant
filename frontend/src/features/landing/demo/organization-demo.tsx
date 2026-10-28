"use client";

import { useTranslations } from "next-intl";
import { OrganizationCard } from "@/features/organizations/components/organization-card";
import { OrganizationProfileHeader } from "@/features/organizations/components/organization-profile-header";
import { DemoRoot } from "./demo-root";
import styles from "../landing.module.css";

/** The organization profile header and list card in their preview form (no uploads, no links). */
export function OrganizationDemo() {
  const t = useTranslations("landing");
  return <DemoRoot>{() => <div className={styles.orgDemo}>
    <OrganizationProfileHeader name={t("demoOrgName")} description={t("demoOrgAbout")} logoShape="SQUARE" logoSrc={null} coverSrc={null} preview />
    <OrganizationCard preview={{ updatedLabel: t("demoOrgUpdated") }}
      organization={{ id: "pda-demo-org", name: t("demoOrgName"), description: t("demoOrgAbout"), status: "ACTIVE", updatedAt: "2026-10-03T09:00:00Z", logoShape: "SQUARE", website: "pda.example.com", location: t("demoOrgLocation") }} />
  </div>}</DemoRoot>;
}
