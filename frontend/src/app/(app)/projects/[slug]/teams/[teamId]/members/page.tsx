import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { buildPath } from "@/i18n/routing";

// The member list moved onto the team page itself; this keeps old links and bookmarks working.
export default async function LegacyTeamMembersRoute({ params }: { params: Promise<{ slug: string; teamId: string }> }) {
  const { slug, teamId } = await params;
  redirect(buildPath("/projects/[slug]/teams/[teamId]", { slug, teamId }, await getLocale() as Locale));
}
