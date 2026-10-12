import { CaretDown } from "@phosphor-icons/react/ssr";

export type FaqGroup = { id: string; title: string; questions: { question: string; answer: string }[] };

/** Shared public/workspace FAQ; translations remain the single source of content. */
export function FaqContent({ groups, idPrefix = "" }: { groups: FaqGroup[]; idPrefix?: string }) {
  return groups.map(group => {
    const id = idPrefix + group.id;
    return (
      <section key={group.id} id={id} aria-labelledby={id + "-title"} className="mb-10 scroll-mt-6 last:mb-0">
        <h2 id={id + "-title"} className="mb-4 text-xl font-semibold">{group.title}</h2>
        <div className="divide-y divide-border border-y border-border">
          {group.questions.map(({ question, answer }, index) => (
            <details key={question} className="group">
              <summary aria-controls={id + "-answer-" + index} className="flex list-none items-start justify-between gap-4 py-5 text-base font-medium outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {question}<CaretDown size={18} aria-hidden="true" className="mt-1 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p id={id + "-answer-" + index} className="pb-5 pr-6 text-base leading-7 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    );
  });
}
