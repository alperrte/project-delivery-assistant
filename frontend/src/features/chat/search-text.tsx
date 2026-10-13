/** Same mixed Turkish/English fold as the server. Plain React text is never interpreted as HTML. */
export function foldSearch(value: string) {
  return value.normalize("NFC").replace(/[Iİı]/g, "i").toLowerCase();
}

export function SearchHighlight({ text, query }: { text: string; query: string }) {
  const normalized = text.normalize("NFC");
  const folded = foldSearch(normalized), term = foldSearch(query.trim());
  if (!term) return normalized;
  const pieces: React.ReactNode[] = [];
  let cursor = 0, match = folded.indexOf(term);
  while (match >= 0) {
    pieces.push(normalized.slice(cursor, match));
    pieces.push(<mark key={match} className="rounded-sm bg-primary/20 text-foreground">{normalized.slice(match, match + term.length)}</mark>);
    cursor = match + term.length;
    match = folded.indexOf(term, cursor);
  }
  pieces.push(normalized.slice(cursor));
  return pieces;
}

export function searchPreview(text: string, query: string) {
  const normalized = text.normalize("NFC");
  const match = foldSearch(normalized).indexOf(foldSearch(query.trim()));
  const start = Math.max(0, match - 55), end = Math.min(normalized.length, Math.max(start + 180, match + query.length));
  return `${start ? "…" : ""}${normalized.slice(start, end)}${end < normalized.length ? "…" : ""}`;
}
