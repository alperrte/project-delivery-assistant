import { BoardPage } from "@/features/tasks/components/board-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("board");

export default async function BoardRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BoardPage slug={slug} />;
}
