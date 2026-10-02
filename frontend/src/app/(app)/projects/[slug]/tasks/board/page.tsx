import { BoardPage } from "@/features/tasks/components/board-page";

export default async function BoardRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BoardPage slug={slug} />;
}
