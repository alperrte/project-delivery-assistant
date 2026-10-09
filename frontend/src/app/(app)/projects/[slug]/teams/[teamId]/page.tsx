import { TeamDetailPage } from "@/features/squads/components/team-detail-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("team");

export default async function TeamDetailRoute({ params }: { params: Promise<{ slug: string; teamId: string }> }) {
  const { slug, teamId } = await params;
  return <TeamDetailPage slug={slug} teamId={teamId} />;
}
