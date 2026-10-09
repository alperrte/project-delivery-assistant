import { TaskFormPage } from "@/features/tasks/components/task-form-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("taskEdit");

export default async function EditTaskRoute({ params }: { params: Promise<{ slug: string; taskId: string }> }) {
  const { slug, taskId } = await params;
  return <TaskFormPage slug={slug} taskId={taskId} />;
}
