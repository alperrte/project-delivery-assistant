import { TeamFormPage } from "@/features/squads/components/team-form-page";

export default async function NewTeamRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamFormPage slug={slug} />;
}