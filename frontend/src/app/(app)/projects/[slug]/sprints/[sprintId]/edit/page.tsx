import { SprintFormPage } from "@/features/sprints/components/sprint-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("sprintEdit");

export default async function EditSprintRoute({ params }: { params: Promise<{ slug: string; sprintId: string }> }) {
  const { slug, sprintId } = await params;
  return <SprintFormPage slug={slug} sprintId={sprintId} />;
}
