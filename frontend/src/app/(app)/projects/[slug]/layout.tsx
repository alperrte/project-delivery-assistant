import type { ReactNode } from "react";
import { ProjectTitle } from "@/features/projects/components/project-title";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <ProjectTitle slug={slug} />
      {children}
    </>
  );
}
