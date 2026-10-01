import { redirect } from "next/navigation";

// The member list moved onto the team page itself; this keeps old links and bookmarks working.
export default async function LegacyTeamMembersRoute({ params }: { params: Promise<{ slug: string; teamId: string }> }) {
  const { slug, teamId } = await params;
  redirect(`/projects/${slug}/teams/${teamId}`);
}
