import { TasksPage } from "@/features/tasks/components/tasks-page";

export default async function TasksRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TasksPage slug={slug} />;
}
