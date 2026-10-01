import { Suspense } from "react";
import { ProjectList } from "@/features/projects/components/project-list";

export default function ProjectsPage() {
  // The list reads `?page=` from the URL, which needs a Suspense boundary during prerender.
  return (
    <Suspense>
      <ProjectList />
    </Suspense>
  );
}
