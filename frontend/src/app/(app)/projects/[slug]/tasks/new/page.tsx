import { TaskFormPage } from "@/features/tasks/components/task-form-page";

export default async function NewTaskRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TaskFormPage slug={slug} />;
}
