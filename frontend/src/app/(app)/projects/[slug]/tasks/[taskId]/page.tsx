import { TaskDetailPage } from "@/features/tasks/components/detail/task-detail-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("task");

export default async function TaskDetailRoute({ params }: { params: Promise<{ slug: string; taskId: string }> }) {
  const { slug, taskId } = await params;
  return <TaskDetailPage slug={slug} taskId={taskId} />;
}
