import { TaskDetailPage } from "@/features/tasks/components/detail/task-detail-page";

export default async function TaskDetailRoute({ params }: { params: Promise<{ slug: string; taskId: string }> }) {
  const { slug, taskId } = await params;
  return <TaskDetailPage slug={slug} taskId={taskId} />;
}
