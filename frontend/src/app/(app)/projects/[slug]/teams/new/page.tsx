import { TeamCreatePage } from "@/features/squads/components/team-create-page";

export default async function NewProjectTeamRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamCreatePage slug={slug} />;
}
