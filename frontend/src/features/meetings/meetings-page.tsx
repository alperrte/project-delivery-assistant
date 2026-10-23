"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import Link, { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { CalendarDays, History, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { EmptyState } from "@/components/common/empty-state";
import { meetingsApi } from "./api";
import { MeetingCard } from "./meeting-card";
import { arrangeMeetings, matchesQuery, PAGE_SIZE, pageFromParam, SORTS, sliceGroups, sortFromParam, STATUS_FILTERS, statusFromParam } from "./meeting-list";
import { MeetingError, useMeetingProject, useNow, useProjectMembers } from "./shared";
import type { Meeting, MeetingStatus } from "./types";

const ALL = "ALL";
const isPast = (meeting: Pick<Meeting, "status">) => meeting.status === "ENDED" || meeting.status === "CANCELLED";

export function MeetingsPage({ slug }: { slug: string }) {
  const t = useTranslations("meetings"), tw = useTranslations("workspace"), locale = useLocale(), client = useQueryClient();
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const context = useMeetingProject(slug), now = useNow(15_000);
  const status = statusFromParam(params.get("status")), sort = sortFromParam(params.get("sort")), urlQuery = params.get("q") ?? "", history = params.get("history") === "1";
  const [search, setSearch] = useState(urlQuery);
  // The URL carries the filter, sort, search, history switch and page; Back/Forward restores them. Search typing replaces the entry instead of piling up history.
  function navigate(changes: Record<string, string | null>, mode: "push" | "replace" = "push") {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    const query = next.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  // Back/Forward (or a cleared filter) changes the URL query: the box follows it, adjusted while rendering rather than in an effect.
  const [seenQuery, setSeenQuery] = useState(urlQuery);
  if (seenQuery !== urlQuery) { setSeenQuery(urlQuery); setSearch(urlQuery); }
  useEffect(() => {
    if (search === urlQuery) return;
    const timer = setTimeout(() => navigate({ q: search.trim() || null, page: null }, "replace"), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate only reads the current URL
  }, [search, urlQuery]);

  const query = useQuery({ queryKey: [...context.keys, "list", "all"], enabled: !!context.project,
    queryFn: ({ signal }) => meetingsApi.listAll(context.project!.id, signal), retry: false, refetchInterval: 15_000 });
  const hiddenQuery = useQuery({ queryKey: [...context.keys, "history"], enabled: !!context.project,
    queryFn: ({ signal }) => meetingsApi.hiddenCount(context.project!.id, signal), retry: false, refetchInterval: 15_000 });
  const members = useProjectMembers(context);
  const memberMap = useMemo(() => new Map((members.data ?? []).map(member => [member.userId, member])), [members.data]);

  const matching = useMemo(() => (query.data?.content ?? []).filter(meeting => matchesQuery(meeting, search, locale)), [query.data, search, locale]);
  // The main view is about what is planned or live; finished and cancelled meetings appear with "Show history" or when their own status is chosen.
  const showPast = history || status === "ENDED" || status === "CANCELLED";
  const scope = useMemo(() => showPast ? matching : matching.filter(meeting => !isPast(meeting)), [matching, showPast]);
  const counts = useMemo(() => {
    const result: Record<string, number> = { [ALL]: scope.length };
    STATUS_FILTERS.forEach(value => { result[value] = matching.filter(meeting => meeting.status === value).length; });
    return result;
  }, [matching, scope]);
  const pastLoaded = (query.data?.content ?? []).filter(isPast).length;
  const arranged = useMemo(() => arrangeMeetings(status ? matching.filter(meeting => meeting.status === status) : scope, sort, now), [matching, scope, status, sort, now]);
  const totalPages = Math.max(1, Math.ceil(arranged.length / PAGE_SIZE));
  const requestedPage = pageFromParam(params.get("page")), page = Math.min(requestedPage, totalPages - 1);
  useEffect(() => { if (query.isSuccess && requestedPage !== page) navigate({ page: page > 0 ? String(page + 1) : null }, "replace"); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, requestedPage, page]);
  const groups = useMemo(() => sliceGroups(arranged.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), now), [arranged, page, now]);

  const statusOptions = [{ value: ALL, label: `${t("all")} (${counts[ALL]})` }, ...STATUS_FILTERS.map(value => ({ value, label: `${t(`status.${value}`)} (${counts[value]})` }))];
  const sortOptions = SORTS.map(value => ({ value, label: t(`sort.${value}`) }));
  const choose = (value: MeetingStatus | typeof ALL) => navigate({ status: value === ALL ? null : value, page: null });
  async function act(meeting: Meeting, action: "cancel" | "end") {
    await meetingsApi.action(context.project!.id, meeting.id, action);
    await client.invalidateQueries({ queryKey: context.keys });
  }
  async function clearHistory() {
    const result = await meetingsApi.clearHistory(context.project!.id);
    await client.invalidateQueries({ queryKey: context.keys });
    toast.success(t("historyCleared", { count: result.count }));
  }
  async function restoreHistory() {
    try {
      const result = await meetingsApi.restoreHistory(context.project!.id);
      await client.invalidateQueries({ queryKey: context.keys });
      toast.success(t("historyRestored", { count: result.count }));
    } catch { toast.error(t("error")); }
  }
  const canEdit = (meeting: Meeting) => context.isManager || context.user?.id === meeting.organizerId;
  const total = query.data?.content.length ?? 0, filtered = !!status || !!search.trim(), restorable = hiddenQuery.data?.count ?? 0;

  return <div className="min-w-0 space-y-5">
    <PageHeader title={t("myMeetings")} description={t("listDescription")}
      action={<Link href={`/projects/${slug}/meetings/new`} className={buttonVariants({ variant: "accent", className: "min-h-11 sm:min-h-10" })}><Plus size={16} aria-hidden="true" />{t("create")}</Link>} />
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* One status dropdown at every width (the same shared Select; the filter lives in the URL). */}
        <Select value={status || ALL} items={statusOptions} modal={false} onValueChange={next => { if (typeof next === "string") choose(next as MeetingStatus | typeof ALL); }}>
          <SelectTrigger aria-label={t("filter")} className="h-11 w-full text-base md:h-10 md:w-56 md:text-sm"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-56">
            {statusOptions.map(option => <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative min-w-0 flex-1">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} aria-label={t("searchMeetings")} placeholder={t("searchMeetings")} className="h-11 pl-9 text-base md:h-10 md:text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/calendar?project=${encodeURIComponent(slug)}`} className={buttonVariants({ variant: "outline", className: "min-h-11 flex-1 border-border-strong md:min-h-10 md:flex-none" })}><CalendarDays size={16} aria-hidden="true" />{tw("calendar")}</Link>
          <Select value={sort} items={sortOptions} modal={false} onValueChange={next => { if (typeof next === "string") navigate({ sort: next === "upcoming" ? null : next, page: null }); }}>
            <SelectTrigger aria-label={t("sortBy")} className="h-11 w-44 flex-1 md:h-10 md:flex-none"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="end">
              {sortOptions.map(option => <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* History: shown on request, clearable for this member only, and restorable. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm md:min-h-9">
          <Checkbox checked={showPast} disabled={status === "ENDED" || status === "CANCELLED"} onCheckedChange={on => navigate({ history: on ? "1" : null, page: null })} />
          <History size={15} aria-hidden="true" className="text-muted-foreground" />{t("showHistory")}
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {pastLoaded > 0 && <ConfirmDialog trigger={<Button variant="ghost" className="min-h-11 text-muted-foreground md:min-h-9"><Trash2 size={15} aria-hidden="true" />{t("clearHistory")}</Button>}
            title={t("clearHistoryTitle")} description={t("clearHistoryBody", { count: pastLoaded })} confirmLabel={t("clearHistoryConfirm")} cancelLabel={t("cancel")} destructive onConfirm={clearHistory} />}
          {restorable > 0 && <Button variant="ghost" className="min-h-11 text-muted-foreground md:min-h-9" onClick={() => void restoreHistory()}><RotateCcw size={15} aria-hidden="true" />{t("restoreHistory", { count: restorable })}</Button>}
        </div>
      </div>
    </div>
    {context.isError ? <MeetingError error={context.error} />
      : query.isError ? <MeetingError error={query.error} retry={() => void query.refetch()} />
      : query.isPending ? <div role="status" aria-label={t("loading")} className="space-y-3">{[0, 1, 2].map(index => <Skeleton key={index} className="h-22 rounded-xl" />)}</div>
      : !total && !restorable ? <EmptyState title={t("empty")} description={t("emptyHint")} action={<Link href={`/projects/${slug}/meetings/new`} className={buttonVariants({ variant: "accent" })}><Plus size={16} aria-hidden="true" />{t("create")}</Link>} />
      : !arranged.length ? <div role="status" className="workspace-panel space-y-3 p-8 text-sm">
          {!showPast && !filtered && pastLoaded > 0
            ? <><p className="font-medium">{t("noUpcoming")}</p><p className="text-muted-foreground">{t("noUpcomingHint")}</p><Button variant="outline" onClick={() => navigate({ history: "1", page: null })}>{t("showHistory")}</Button></>
            : <><p className="font-medium">{t("noResults")}</p><p className="text-muted-foreground">{t("noResultsHint")}</p>
              {filtered && <Button variant="outline" onClick={() => { setSearch(""); navigate({ status: null, q: null, page: null }); }}>{t("clearFilters")}</Button>}</>}
        </div>
      : <>
        <div className="space-y-6">{groups.map(group => <section key={group.key} aria-labelledby={`meeting-group-${group.key}`} className="space-y-2.5">
          <h2 id={`meeting-group-${group.key}`} className="px-1 text-sm font-semibold text-muted-foreground">{t(`group_${group.key}`)}</h2>
          <div className="space-y-2.5">{group.meetings.map(meeting => <MeetingCard key={meeting.id} meeting={meeting} slug={slug} projectName={context.project?.name} members={memberMap} now={now}
            canEdit={canEdit(meeting)} canEnd={context.user?.id === meeting.organizerId} onAction={act} />)}</div>
        </section>)}</div>
        {query.data && !query.data.complete && <p role="status" className="text-xs text-muted-foreground">{t("listTruncated")}</p>}
        <PaginationBar page={page} totalPages={totalPages} totalElements={arranged.length} pageSize={PAGE_SIZE} onPageChange={next => navigate({ page: next > 0 ? String(next + 1) : null })} />
      </>}
  </div>;
}
