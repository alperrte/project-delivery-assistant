import { TeamMembersPage } from "@/features/squads/components/team-members-page";

export default async function ProjectTeamMembersRoute({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}) {
  const { slug, teamId } = await params;
  return <TeamMembersPage slug={slug} teamId={teamId} />;
}
