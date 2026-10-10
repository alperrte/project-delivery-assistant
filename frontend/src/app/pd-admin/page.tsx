import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AdminLoginPage } from "@/features/admin-auth/components/admin-login-page";
import type { AdminLoginNotice } from "@/features/admin-auth/components/admin-login-flow";

/**
 * The separate administrator sign-in. One unprefixed address: the language comes from the NEXT_LOCALE cookie or the
 * browser's Accept-Language (see `i18n/request.ts`). Never linked from a public page, never in robots.txt or the
 * sitemap, and never indexed. Hiding it is not a security control; the backend authorizes every admin request.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminLogin");
  return { title: t("metaTitle"), description: t("metaDescription"), robots: { index: false, follow: false } };
}

const NOTICES: Record<string, AdminLoginNotice> = { "session-expired": "sessionExpired", reauthenticate: "reauthenticate" };

export default async function AdminEntryPage({ searchParams }: { searchParams: Promise<{ reason?: string | string[] }> }) {
  const [{ reason }, jar] = await Promise.all([searchParams, cookies()]);
  const key = Array.isArray(reason) ? reason[0] : reason;
  return <AdminLoginPage hasSessionHint={jar.has("PDA_SESSION")} notice={key && Object.hasOwn(NOTICES, key) ? NOTICES[key] : null} />;
}
