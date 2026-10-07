import { ProjectCard, type ProjectCardData, type ProjectCardPreview } from "./project-card";

/**
 * The live preview beside a project form: the real card, in `preview` mode, so what is edited is what the Projeler list
 * will show. Sticky on wide screens; below `lg` it sits under the form and the form's action bar links to it.
 */
export function ProjectPreviewPanel({ title, caption, project, preview }: {
  title: string;
  caption: string;
  project: ProjectCardData;
  preview: ProjectCardPreview;
}) {
  return (
    <aside id="project-preview" aria-label={title} className="min-w-0 scroll-mt-24 lg:col-span-5">
      <div className="space-y-3 lg:sticky lg:top-24">
        <div className="space-y-0.5">
          <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{caption}</p>
        </div>
        <div className="mx-auto max-w-sm lg:max-w-none">
          <ProjectCard project={project} preview={preview} />
        </div>
      </div>
    </aside>
  );
}
