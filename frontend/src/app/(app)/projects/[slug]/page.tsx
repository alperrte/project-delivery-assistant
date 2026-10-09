import { ProjectDetail } from "@/features/projects/components/project-detail";
import { pageTitle, type PageTitleKey } from "@/lib/seo/page-title";

/** The proxy rewrites each section's own URL (e.g. /tr/projeler/x/ekipler) to this page with `?section=`. */
const SECTION_TITLES: Record<string, PageTitleKey> = {
  overview: "projectOverview", criteria: "projectCriteria", teams: "projectTeams", members: "projectTeams",
  squads: "projectTeams", invitations: "projectInvitations", repository: "projectRepository", settings: "projectEdit",
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section = "overview" } = await searchParams;
  return pageTitle(Object.hasOwn(SECTION_TITLES, section) ? SECTION_TITLES[section] : "projectOverview");
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProjectDetail slug={slug} />;
}
