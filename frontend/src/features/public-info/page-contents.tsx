/** "On this page" list that stays beside the content on wide screens and sits above it on narrow ones. */
export function PageContents({ label, items }: { label: string; items: readonly { id: string; title: string }[] }) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-6 lg:self-start">
      <h2 className="text-sm font-semibold">{label}</h2>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 lg:block lg:space-y-1">
        {items.map(({ id, title }) => <li key={id}><a href={"#" + id} className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{title}</a></li>)}
      </ul>
    </nav>
  );
}
