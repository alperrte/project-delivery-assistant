import { InviteMemberPage } from "@/features/squads/components/invite-member-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("memberInvite");

/** `?team=<teamId>` is set when the page is opened from a team: that team is fixed and success returns to it. */
export default async function InviteMemberRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  const [{ slug }, { team }] = await Promise.all([params, searchParams]);
  return <InviteMemberPage slug={slug} teamId={typeof team === "string" ? team : undefined} />;
}
