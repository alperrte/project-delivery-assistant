import { ProjectCreatePage } from "@/features/projects/components/project-create-page";
import { pageTitle } from "@/lib/seo/page-title";

export const generateMetadata = () => pageTitle("projectNew");

export default function NewProjectPage() {
  return <ProjectCreatePage />;
}
