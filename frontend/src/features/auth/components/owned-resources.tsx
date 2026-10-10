import type { OwnedResource } from "@/features/auth/api";

/** Projects and organizations that still belong to the account; deleting it is refused until they are handed over or removed. */
export function OwnedResources({
  items,
  title,
  text,
  labels,
}: {
  items: OwnedResource[];
  title: string;
  text: string;
  labels: { project: string; organization: string };
}) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
      <div>
        <p className="font-semibold text-destructive">{title}</p>
        <p className="mt-1 text-muted-foreground">{text}</p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="rounded bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              {item.kind === "PROJECT" ? labels.project : labels.organization}
            </span>
            <span className="min-w-0 break-words font-medium">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
