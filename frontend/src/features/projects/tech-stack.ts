const SEPARATOR = /[,;\n]/;

/** `techStack` is stored as one free-text string; items are comma separated. */
export function parseTechStack(techStack: string | null | undefined): string[] {
  return (techStack ?? "").split(SEPARATOR).map((item) => item.trim()).filter(Boolean);
}

export function formatTechStack(items: string[]): string {
  return items.join(", ");
}
