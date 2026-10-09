import { TaskFormPage } from "@/features/tasks/components/task-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("taskNew");

export default async function NewTaskRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TaskFormPage slug={slug} />;
}
