import { TeamFormPage } from "@/features/squads/components/team-form-page";

export default async function EditTeamRoute({ params }: { params: Promise<{ slug: string; teamId: string }> }) {
  const { slug, teamId } = await params;
  return <TeamFormPage slug={slug} teamId={teamId} />;
}
