import { defaultLocale, isLocale, type Locale } from "./config";

/** Page routes only. API and WebSocket paths keep their existing, untranslated contract. */
export const PAGE_ROUTES = [
  "/",
  "/dashboard",
  "/projects",
  "/projects/new",
  "/projects/[slug]",
  "/projects/[slug]/overview",
  "/projects/[slug]/criteria",
  "/projects/[slug]/criteria/new",
  "/projects/[slug]/criteria/[criterionId]/edit",
  "/projects/[slug]/teams",
  "/projects/[slug]/team-invitations",
  "/projects/[slug]/team-invitations/new",
  "/projects/[slug]/repository",
  "/projects/[slug]/edit",
  "/projects/[slug]/teams/new",
  "/projects/[slug]/teams/[teamId]",
  "/projects/[slug]/teams/[teamId]/edit",
  "/projects/[slug]/teams/[teamId]/members",
  "/projects/[slug]/tasks",
  "/projects/[slug]/tasks/new",
  "/projects/[slug]/tasks/board",
  "/projects/[slug]/tasks/pool",
  "/projects/[slug]/tasks/[taskId]",
  "/projects/[slug]/tasks/[taskId]/edit",
  "/projects/[slug]/sprints",
  "/projects/[slug]/sprints/new",
  "/projects/[slug]/sprints/[sprintId]",
  "/projects/[slug]/sprints/[sprintId]/edit",
  "/projects/[slug]/labels",
  "/organizations",
  "/organizations/new",
  "/organizations/[organizationId]",
  "/organizations/[organizationId]/edit",
  "/settings",
  "/account",
  "/tasks",
  "/calendar",
  "/calendar/new",
  "/calendar/reminders/[reminderId]/edit",
  "/invitations",
  "/invitations/[projectId]/[invitationId]",
  "/login",
  "/register",
  "/change-password",
  "/forgot-password",
  "/verify-email",
  "/delete-account",
  "/faq",
  "/privacy",
  "/cookies",
  "/contact",
  "/admin",
  "/admin/users",
  "/admin/analytics",
  "/kvkk",
  "/accessibility",
  "/license",
  "/about",
  "/errors/[code]",
  "/dev/error-test",
] as const;

export type PageRoute = (typeof PAGE_ROUTES)[number];

/** The English keys are the physical App Router segments. Dynamic values never pass through this table. */
const SEGMENTS: Record<Locale, Record<string, string>> = {
  en: {},
  tr: {
    dashboard: "genel-bakis", projects: "projeler", teams: "ekipler", members: "uyeler",
    tasks: "gorevler", new: "yeni", edit: "duzenle", board: "pano", pool: "havuz",
    sprints: "sprintler", labels: "etiketler", organizations: "organizasyonlar",
    settings: "ayarlar", account: "hesap", calendar: "takvim", reminders: "animsaticilar",
    invitations: "davetler", login: "giris", register: "kayit",
    "change-password": "sifre-degistir", "forgot-password": "sifremi-unuttum",
    "verify-email": "e-posta-dogrula", "delete-account": "hesap-sil",
    faq: "sss", privacy: "gizlilik", cookies: "cerez-politikasi", contact: "iletisim", admin: "yonetim", users: "kullanicilar", analytics: "analitik", accessibility: "erisilebilirlik",
    license: "lisans", about: "hakkimizda",
    errors: "hatalar", "error-test": "hata-testi",
    overview: "genel-bakis", criteria: "kriterler", "team-invitations": "ekip-davetleri", repository: "depo",
  },
  de: {
    dashboard: "uebersicht", projects: "projekte", teams: "teams", members: "mitglieder",
    tasks: "aufgaben", new: "neu", edit: "bearbeiten", board: "board", pool: "pool",
    sprints: "sprints", labels: "labels", organizations: "organisationen",
    settings: "einstellungen", account: "konto", calendar: "kalender", reminders: "erinnerungen",
    invitations: "einladungen", login: "anmelden", register: "registrieren",
    "change-password": "passwort-aendern", "forgot-password": "passwort-vergessen",
    "verify-email": "email-bestaetigen", "delete-account": "konto-loeschen",
    faq: "faq", privacy: "datenschutz", cookies: "cookie-richtlinie", contact: "kontakt", admin: "verwaltung", users: "benutzer", analytics: "analyse", accessibility: "barrierefreiheit",
    license: "lizenz", about: "ueber-uns",
    errors: "fehler", "error-test": "fehlertest",
    overview: "uebersicht", criteria: "kriterien", "team-invitations": "team-einladungen", repository: "repository",
  },
};

/**
 * Pages whose last segment says what the page is for, instead of the generic "new" / "tasks" shared with other routes.
 * The old generic form still resolves and is redirected to this one.
 */
const LEAF_SEGMENTS: Partial<Record<PageRoute, Record<Locale, string>>> = {
  "/projects/new": { en: "new-project", tr: "yeni-proje", de: "neues-projekt" },
  "/organizations/new": { en: "new-organization", tr: "yeni-organizasyon", de: "neue-organisation" },
  "/projects/[slug]/teams/new": { en: "new-team", tr: "yeni-ekip", de: "neues-team" },
  "/projects/[slug]/tasks/new": { en: "new-task", tr: "yeni-gorev", de: "neue-aufgabe" },
  "/calendar/new": { en: "new-reminder", tr: "yeni-animsatici", de: "neue-erinnerung" },
  "/tasks": { en: "my-tasks", tr: "gorevlerim", de: "meine-aufgaben" },
};

/**
 * The project page is one physical page (`/projects/[slug]?section=...`), but each section has its own public URL
 * (e.g. /tr/projeler/x/ekipler). The proxy rewrites the public URL back to the `section` query the page reads.
 */
const SECTION_ROUTES = {
  overview: "/projects/[slug]/overview",
  criteria: "/projects/[slug]/criteria",
  teams: "/projects/[slug]/teams",
  members: "/projects/[slug]/teams",
  squads: "/projects/[slug]/teams",
  invitations: "/projects/[slug]/team-invitations",
  repository: "/projects/[slug]/repository",
  settings: "/projects/[slug]/edit",
} as const satisfies Record<string, PageRoute>;

const ROUTE_SECTIONS: Partial<Record<PageRoute, string>> = {
  "/projects/[slug]/overview": "overview",
  "/projects/[slug]/criteria": "criteria",
  "/projects/[slug]/teams": "teams",
  "/projects/[slug]/team-invitations": "invitations",
  "/projects/[slug]/repository": "repository",
  "/projects/[slug]/edit": "settings",
};

/** The home page has no physical segment: it is served from `/` and only its public URL is named (e.g. /tr/ana-sayfa). */
const HOME_SEGMENT: Record<Locale, string> = { en: "home", tr: "ana-sayfa", de: "startseite" };

const isParameter = (part: string) => part.startsWith("[") && part.endsWith("]");
const partsOf = (path: string) => path.split("/").filter(Boolean);
const cleanPath = (path: string) => path === "/" ? path : path.replace(/\/+$/, "");
const routeParts = (route: PageRoute, locale: Locale, legacy = false) => {
  if (route === "/") return [HOME_SEGMENT[locale]];
  const parts = partsOf(route).map((part) => isParameter(part) ? part : (SEGMENTS[locale][part] ?? part));
  const leaf = legacy ? undefined : LEAF_SEGMENTS[route]?.[locale];
  if (leaf) parts[parts.length - 1] = leaf;
  return parts;
};

type Match = { route: PageRoute; params: Record<string, string> };

function matchRoute(parts: string[], locale: Locale): Match | null {
  // A bare `/` or `/tr` has no segment; it still resolves to the home page and is then redirected to its named URL.
  if (parts.length === 0) return { route: "/", params: {} };
  // Literal routes precede dynamic ones (e.g. projects/new before projects/[slug]).
  const routes = [...PAGE_ROUTES].sort((a, b) =>
    partsOf(b).filter((part) => !isParameter(part)).length - partsOf(a).filter((part) => !isParameter(part)).length);
  const templates = routes.flatMap((route) => [
    { route, template: routeParts(route, locale) },
    ...(LEAF_SEGMENTS[route] ? [{ route, template: routeParts(route, locale, true) }] : []),
  ]);
  for (const { route, template } of templates) {
    if (template.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let valid = true;
    for (let i = 0; i < parts.length; i++) {
      if (isParameter(template[i])) {
        try {
          if (decodeURIComponent(parts[i]).includes("/")) {
            valid = false;
            break;
          }
        } catch {
          valid = false;
          break;
        }
        params[template[i].slice(1, -1)] = parts[i];
      } else if (template[i] !== parts[i]) {
        valid = false;
        break;
      }
    }
    if (valid) return { route, params };
  }
  return null;
}

export function buildPath(route: PageRoute, params: Record<string, string>, locale: Locale): string {
  const parts = routeParts(route, locale).map((part) => {
    if (!isParameter(part)) return part;
    const value = params[part.slice(1, -1)];
    if (!value || value.includes("/")) throw new Error(`Invalid route parameter: ${part}`);
    return encodeURIComponent(decodeURIComponent(value));
  });
  return `/${locale}${parts.length ? `/${parts.join("/")}` : ""}`;
}

export type ResolvedPage = {
  locale: Locale;
  route: PageRoute;
  params: Record<string, string>;
  internalPath: string;
  /** The `section` query the physical project page needs, for the project section routes. */
  section?: string;
  canonicalPath: string;
};

/** Accepts canonical localized, old unprefixed, and mismatched localized bookmarks. */
export function matchPath(pathname: string, preferredLocale: Locale = defaultLocale): ResolvedPage | null {
  // Every public address is lowercase (segments, slugs and ids alike), so `/TR/Hakkimizda` is the same page and
  // is redirected to its lowercase canonical form instead of being a 404.
  const path = cleanPath(pathname).toLowerCase();
  const parts = partsOf(path);
  const prefix = parts[0];
  const prefixed = isLocale(prefix);
  const locale = prefixed ? prefix : preferredLocale;
  const body = prefixed ? parts.slice(1) : parts;
  const matches = ([locale, "en", "tr", "de"] as Locale[]).filter((value, index, all) => all.indexOf(value) === index);
  for (const sourceLocale of matches) {
    const found = matchRoute(body, sourceLocale);
    if (!found) continue;
    const section = ROUTE_SECTIONS[found.route];
    const physical = section ? partsOf(found.route).slice(0, -1) : partsOf(found.route);
    const internalPath = found.route === "/" ? "/" : `/${physical.map((part) =>
      isParameter(part) ? found.params[part.slice(1, -1)] : part).join("/")}`;
    return {
      locale, route: found.route, params: found.params, internalPath, section,
      canonicalPath: buildPath(found.route, found.params, locale),
    };
  }
  return null;
}

/**
 * `/projects/x?section=teams` is the older way to name a project section; it becomes the section's own route.
 * Every other route, and the rest of the query, is returned unchanged.
 */
export function normalizeProjectSection(route: PageRoute, search: string): { route: PageRoute; search: string } {
  if (route !== "/projects/[slug]") return { route, search };
  const params = new URLSearchParams(search);
  const section = params.get("section") ?? "overview";
  params.delete("section");
  const rest = params.toString();
  return {
    route: Object.hasOwn(SECTION_ROUTES, section) ? SECTION_ROUTES[section as keyof typeof SECTION_ROUTES] : SECTION_ROUTES.overview,
    search: rest ? `?${rest}` : "",
  };
}

/** Converts a logical English page URL to its public localized URL, leaving search/hash intact. */
export function localizeHref(href: string, locale: Locale): string {
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(href);
  if (!match) return href;
  const page = matchPath(match[1], locale);
  if (!page) return href;
  const target = normalizeProjectSection(page.route, match[2] ?? "");
  return `${buildPath(target.route, page.params, locale)}${target.search}${match[3] ?? ""}`;
}

export function switchLocale(pathname: string, search: string, target: Locale, hash = ""): string {
  const current = matchPath(pathname, target);
  return current
    ? `${buildPath(current.route, current.params, target)}${search}${hash}`
    : `/${target}`;
}
