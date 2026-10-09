"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api";

const ERROR_TITLE = /^\d{3} · /;

/**
 * Page titles are rendered on the server, which does not know the project's name (the record needs the session).
 * Once the project is loaded this puts the name in front of the tab title ("Genel bakış · PDA" → "Proje · Genel bakış · PDA")
 * and keeps doing so when navigating between the project's pages, which each bring their own title.
 */
export function ProjectTitle({ slug }: { slug: string }) {
  const { data: project } = useQuery({
    queryKey: ["projects", "by-slug", slug],
    queryFn: () => projectsApi.bySlug(slug),
  });
  const name = project?.name;

  useEffect(() => {
    if (!name) return;
    const prefix = `${name} · `;
    const apply = () => {
      const title = document.title;
      if (!title.startsWith(prefix) && !ERROR_TITLE.test(title)) document.title = `${prefix}${title}`;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [name]);

  return null;
}
