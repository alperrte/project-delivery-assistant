import { TeamDetailPage } from "@/features/squads/components/team-detail-page";

export default async function TeamDetailRoute({ params }: { params: Promise<{ slug: string; teamId: string }> }) {
  const { slug, teamId } = await params;
  return <TeamDetailPage slug={slug} teamId={teamId} />;
}
