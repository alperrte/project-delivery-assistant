import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LandingPage } from "@/features/landing/landing-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: { absolute: `${t("metaTitle")} · PDA` }, description: t("metaDescription"),
    alternates: { canonical: "/" },
    openGraph: {
      type: "website", title: t("metaTitle"), description: t("metaDescription"), url: "/",
      images: [{ url: "/images/branding/pda-full.png", alt: "PDA · Project Delivery Assistant" }],
    },
  };
}

export default async function Home() {
  // The hint only selects a destination; AppShell and the API verify the session.
  if ((await cookies()).has("PDA_SESSION")) redirect("/dashboard");
  return <LandingPage />;
}
