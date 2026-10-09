import { TasksPage } from "@/features/tasks/components/tasks-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("tasks");

export default async function TasksRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TasksPage slug={slug} />;
}
