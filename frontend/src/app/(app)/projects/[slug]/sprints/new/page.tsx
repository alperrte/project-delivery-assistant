import { SprintFormPage } from "@/features/sprints/components/sprint-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("sprintNew");

export default async function NewSprintRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SprintFormPage slug={slug} />;
}
