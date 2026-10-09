import { TeamFormPage } from "@/features/squads/components/team-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("teamNew");

export default async function NewTeamRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamFormPage slug={slug} />;
}
