type Identity = { firstName?: string | null; lastName?: string | null; nickname?: string | null };

export function memberDisplayName(person: Identity) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.nickname?.trim() || "?";
}

/** Real name tokens, Unicode graphemes and locale-aware uppercase; missing names never acquire a guessed surname. */
export function memberInitials(person: Identity, locale: string) {
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  const tokens = full.split(/\s+/u).filter(token => /[\p{L}\p{N}]/u.test(token));
  const first = (text: string) => {
    const meaningful = text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*/u)?.[0] ?? "";
    const value = typeof Intl.Segmenter === "function"
      ? [...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(meaningful)][0]?.segment
      : Array.from(meaningful)[0];
    return value?.toLocaleUpperCase(locale) ?? "?";
  };
  if (!tokens.length) return first(person.nickname?.trim() ?? "");
  return tokens.length === 1 ? first(tokens[0]) : `${first(tokens[0])}.${first(tokens[tokens.length - 1])}`;
}
