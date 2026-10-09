import { Suspense } from "react";
import { ProjectList } from "@/features/projects/components/project-list";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("projects");

export default function ProjectsPage() {
  // The list reads `?page=` from the URL, which needs a Suspense boundary during prerender.
  return (
    <Suspense>
      <ProjectList />
    </Suspense>
  );
}
