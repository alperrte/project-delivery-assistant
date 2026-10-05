import { defaultLocale, isLocale, type Locale } from "./config";

/** Page routes only. API and WebSocket paths keep their existing, untranslated contract. */
export const PAGE_ROUTES = [
  "/",
  "/dashboard",
  "/projects",
  "/projects/new",
  "/projects/[slug]",
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
  "/projects/[slug]/sprints/[sprintId]",
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
  "/faq",
  "/privacy",
  "/kvkk",
  "/accessibility",
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
    faq: "sss", privacy: "gizlilik", accessibility: "erisilebilirlik",
    errors: "hatalar", "error-test": "hata-testi",
  },
  de: {
    dashboard: "uebersicht", projects: "projekte", teams: "teams", members: "mitglieder",
    tasks: "aufgaben", new: "neu", edit: "bearbeiten", board: "tafel", pool: "pool",
    sprints: "sprints", labels: "etiketten", organizations: "organisationen",
    settings: "einstellungen", account: "konto", calendar: "kalender", reminders: "erinnerungen",
    invitations: "einladungen", login: "anmelden", register: "registrieren",
    "change-password": "passwort-aendern", "forgot-password": "passwort-vergessen",
    faq: "faq", privacy: "datenschutz", accessibility: "barrierefreiheit",
    errors: "fehler", "error-test": "fehlertest",
  },
};

const isParameter = (part: string) => part.startsWith("[") && part.endsWith("]");
const partsOf = (path: string) => path.split("/").filter(Boolean);
const cleanPath = (path: string) => path === "/" ? path : path.replace(/\/+$/, "");
const routeParts = (route: PageRoute, locale: Locale) =>
  partsOf(route).map((part) => isParameter(part) ? part : (SEGMENTS[locale][part] ?? part));

type Match = { route: PageRoute; params: Record<string, string> };

function matchRoute(parts: string[], locale: Locale): Match | null {
  // Literal routes precede dynamic ones (e.g. projects/new before projects/[slug]).
  const routes = [...PAGE_ROUTES].sort((a, b) =>
    partsOf(b).filter((part) => !isParameter(part)).length - partsOf(a).filter((part) => !isParameter(part)).length);
  for (const route of routes) {
    const template = routeParts(route, locale);
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
  canonicalPath: string;
};

/** Accepts canonical localized, old unprefixed, and mismatched localized bookmarks. */
export function matchPath(pathname: string, preferredLocale: Locale = defaultLocale): ResolvedPage | null {
  const path = cleanPath(pathname);
  const parts = partsOf(path);
  const prefix = parts[0];
  const prefixed = isLocale(prefix);
  const locale = prefixed ? prefix : preferredLocale;
  const body = prefixed ? parts.slice(1) : parts;
  const matches = ([locale, "en", "tr", "de"] as Locale[]).filter((value, index, all) => all.indexOf(value) === index);
  for (const sourceLocale of matches) {
    const found = matchRoute(body, sourceLocale);
    if (!found) continue;
    const internalPath = found.route === "/" ? "/" : `/${partsOf(found.route).map((part) =>
      isParameter(part) ? found.params[part.slice(1, -1)] : part).join("/")}`;
    return {
      locale, route: found.route, params: found.params, internalPath,
      canonicalPath: buildPath(found.route, found.params, locale),
    };
  }
  return null;
}

/** Converts a logical English page URL to its public localized URL, leaving search/hash intact. */
export function localizeHref(href: string, locale: Locale): string {
  const match = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(href);
  if (!match) return href;
  const route = matchPath(match[1], locale);
  return route ? `${buildPath(route.route, route.params, locale)}${match[2] ?? ""}${match[3] ?? ""}` : href;
}

export function switchLocale(pathname: string, search: string, target: Locale, hash = ""): string {
  const current = matchPath(pathname, target);
  return current
    ? `${buildPath(current.route, current.params, target)}${search}${hash}`
    : `/${target}`;
}
