import type { ProjectType } from "./types";

/**
 * Technologies a project can be tagged with. `techStack` stays one comma separated string, so the stored value is
 * always the canonical `name`; free text from older projects simply has no catalog entry and renders as a text chip.
 */
export type TechItem = {
  id: string;
  name: string;
  /** File under `public/images/tech`; `null` renders a letter badge instead. */
  icon: string | null;
  /** Single-colour logo: inverted in dark mode so it stays visible. */
  mono?: boolean;
  /** Extra spellings accepted when reading an existing `techStack`. */
  aliases?: string[];
};

const item = (id: string, name: string, extra: Partial<Omit<TechItem, "id" | "name">> = {}): TechItem => ({
  id,
  name,
  icon: `/images/tech/${id}.svg`,
  ...extra,
});

export const TECH_CATALOG: Record<string, TechItem> = Object.fromEntries(
  [
    item("react", "React", { aliases: ["reactjs", "react.js"] }),
    // React Native shares the React mark, there is no separate devicon file.
    { ...item("react", "React Native", { aliases: ["reactnative"] }), id: "reactnative" },
    item("nextjs", "Next.js", { mono: true, aliases: ["next", "nextjs"] }),
    item("vue", "Vue", { aliases: ["vue.js", "vuejs"] }),
    item("angular", "Angular"),
    item("svelte", "Svelte"),
    item("typescript", "TypeScript", { aliases: ["ts"] }),
    item("tailwindcss", "Tailwind CSS", { aliases: ["tailwind"] }),
    item("nodejs", "Node.js", { aliases: ["node", "nodejs"] }),
    item("spring", "Spring Boot", { aliases: ["spring", "springboot"] }),
    item("django", "Django"),
    item("fastapi", "FastAPI"),
    item("dotnet", ".NET", { aliases: ["dotnet", "asp.net", ".net core"] }),
    item("laravel", "Laravel"),
    item("go", "Go", { aliases: ["golang"] }),
    item("postgresql", "PostgreSQL", { aliases: ["postgres"] }),
    item("mysql", "MySQL"),
    item("mongodb", "MongoDB", { aliases: ["mongo"] }),
    item("redis", "Redis"),
    item("sqlite", "SQLite"),
    item("docker", "Docker"),
    item("flutter", "Flutter"),
    item("kotlin", "Kotlin"),
    item("swift", "Swift"),
    item("expo", "Expo", { mono: true }),
    item("androidstudio", "Android Studio"),
    item("xcode", "Xcode"),
    item("firebase", "Firebase"),
    item("supabase", "Supabase"),
    item("python", "Python"),
    item("jupyter", "Jupyter"),
    item("pytorch", "PyTorch"),
    item("tensorflow", "TensorFlow"),
    item("scikitlearn", "scikit-learn", { aliases: ["sklearn", "scikitlearn"] }),
    item("huggingface", "Hugging Face", { mono: true, aliases: ["huggingface"] }),
    item("langchain", "LangChain", { mono: true }),
    item("openai", "OpenAI", { mono: true }),
    item("anthropic", "Anthropic Claude", { mono: true, aliases: ["anthropic", "claude"] }),
    { id: "pinecone", name: "Pinecone", icon: null },
    item("electron", "Electron"),
    item("tauri", "Tauri", { mono: true }),
    item("qt", "Qt"),
    item("java", "Java"),
    item("rust", "Rust", { mono: true }),
  ].map((tech) => [tech.id, tech]),
);

export type TechGroup = { key: string; items: TechItem[] };

const ids = (...list: string[]): TechItem[] => list.map((id) => TECH_CATALOG[id]);

const GROUPS_BY_TYPE: Record<Exclude<ProjectType, "OTHER">, TechGroup[]> = {
  WEB: [
    { key: "frontend", items: ids("react", "nextjs", "vue", "angular", "svelte", "typescript", "tailwindcss") },
    { key: "backend", items: ids("nodejs", "spring", "django", "fastapi", "dotnet", "laravel", "go") },
    { key: "database", items: ids("postgresql", "mysql", "mongodb", "redis") },
    { key: "infrastructure", items: ids("docker") },
  ],
  MOBILE: [
    { key: "app", items: ids("flutter", "reactnative", "kotlin", "swift", "expo") },
    { key: "tools", items: ids("androidstudio", "xcode") },
    { key: "backendService", items: ids("firebase", "supabase", "nodejs", "spring") },
    { key: "data", items: ids("sqlite", "postgresql") },
  ],
  AI: [
    { key: "language", items: ids("python", "jupyter") },
    { key: "framework", items: ids("pytorch", "tensorflow", "scikitlearn", "huggingface", "langchain") },
    { key: "provider", items: ids("openai", "anthropic") },
    { key: "services", items: ids("fastapi", "postgresql", "pinecone", "docker") },
  ],
  DESKTOP: [{ key: "desktop", items: ids("electron", "tauri", "dotnet", "qt", "java", "rust") }],
};

export const MAX_TECH_SELECTION = 12;

/** Suggested technologies for a type. OTHER (or no type yet) offers the whole catalog in one searchable list. */
export function techGroupsFor(type: ProjectType | undefined): TechGroup[] {
  if (type && type !== "OTHER") return GROUPS_BY_TYPE[type];
  return [{ key: "all", items: Object.values(TECH_CATALOG) }];
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("en");

const LOOKUP = new Map<string, TechItem>();
for (const tech of Object.values(TECH_CATALOG)) {
  LOOKUP.set(normalize(tech.name), tech);
  for (const alias of tech.aliases ?? []) LOOKUP.set(normalize(alias), tech);
}

/** Resolves one stored label to its catalog entry; `null` for free text the catalog does not know. */
export function resolveTech(label: string): TechItem | null {
  return LOOKUP.get(normalize(label)) ?? null;
}

/** Selected labels normalised to canonical names, unknown text kept as typed, duplicates dropped. */
export function canonicalTech(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels) {
    const name = resolveTech(label)?.name ?? label.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}
