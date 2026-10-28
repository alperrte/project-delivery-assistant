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
import { arrangeMeetings, kindFromParam, matchesKind, matchesQuery, PAGE_SIZE, pageFromParam, projectsOf, SORTS, sliceGroups, sortFromParam, STATUS_FILTERS, statusFromParam } from "./meeting-list";
import { MeetingError, useMeetingAccount, useNow } from "./shared";
import type { Meeting, MeetingStatus } from "./types";

const ALL = "ALL";
const isPast = (meeting: Pick<Meeting, "status">) => meeting.status === "ENDED" || meeting.status === "CANCELLED";

/** Every meeting the signed-in user organizes or attends, from every project and from none. Nothing here depends on a selected project. */
export function MeetingsPage() {
  const t = useTranslations("meetings"), tw = useTranslations("workspace"), locale = useLocale(), client = useQueryClient();
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const context = useMeetingAccount(), now = useNow(15_000);
  const kind = kindFromParam(params.get("type")), projectId = kind === "project" ? params.get("project") ?? "" : "";
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

  const query = useQuery({ queryKey: [...context.keys, "list", "all"], enabled: !!context.user,
    queryFn: ({ signal }) => meetingsApi.listAll(signal), retry: false, refetchInterval: 15_000 });
  const hiddenQuery = useQuery({ queryKey: [...context.keys, "history"], enabled: !!context.user,
    queryFn: ({ signal }) => meetingsApi.hiddenCount(signal), retry: false, refetchInterval: 15_000 });

  const projects = useMemo(() => projectsOf(query.data?.content ?? []), [query.data]);
  // Kind and project only narrow the viewer's own meetings (the server already limited them to organizer/attendee); a stale project in the URL simply matches nothing.
  const matching = useMemo(() => (query.data?.content ?? []).filter(meeting => matchesKind(meeting, kind, projectId) && matchesQuery(meeting, search, locale)), [query.data, search, locale, kind, projectId]);
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
  const kindOptions = [{ value: ALL, label: t("kindAll") }, { value: "project", label: t("kindProjects") }, { value: "independent", label: t("kindIndependents") }];
  const projectOptions = [{ value: ALL, label: t("allProjects") }, ...projects.map(project => ({ value: project.id, label: project.name }))];
  const choose = (value: MeetingStatus | typeof ALL) => navigate({ status: value === ALL ? null : value, page: null });
  async function act(meeting: Meeting, action: "cancel" | "end") {
    await meetingsApi.action(meeting.id, action);
    await client.invalidateQueries({ queryKey: context.keys });
  }
  async function clearHistory() {
    const result = await meetingsApi.clearHistory();
    await client.invalidateQueries({ queryKey: context.keys });
    toast.success(t("historyCleared", { count: result.count }));
  }
  async function restoreHistory() {
    try {
      const result = await meetingsApi.restoreHistory();
      await client.invalidateQueries({ queryKey: context.keys });
      toast.success(t("historyRestored", { count: result.count }));
    } catch { toast.error(t("error")); }
  }
  // Only the organizer manages a meeting; no project role gives anyone that right (the server enforces it too).
  const canEdit = (meeting: Meeting) => context.user?.id === meeting.organizerId;
  const total = query.data?.content.length ?? 0, filtered = !!status || !!search.trim() || !!kind, restorable = hiddenQuery.data?.count ?? 0;

  return <div className="min-w-0 space-y-5 [&>div:first-child_p]:max-w-none">
    <PageHeader title={t("myMeetings")} description={t("listDescription")}
      action={<Link href="/meetings/new" className={buttonVariants({ variant: "accent", className: "min-h-11 sm:min-h-10" })}><Plus size={16} aria-hidden="true" />{t("create")}</Link>} />
    <div className="space-y-3">
      <div data-meeting-toolbar className="grid grid-cols-1 items-center gap-2 min-[480px]:grid-cols-2 md:flex md:flex-wrap">
        <div className="relative min-w-0 min-[480px]:col-span-2 md:w-[300px] md:shrink-0">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} aria-label={t("searchMeetings")} placeholder={t("searchMeetings")} className="h-11 pl-9 text-base md:h-10 md:text-sm" />
        </div>
        {/* One status dropdown at every width (the same shared Select; the filter lives in the URL). */}
        <Select value={status || ALL} items={statusOptions} modal={false} onValueChange={next => { if (typeof next === "string") choose(next as MeetingStatus | typeof ALL); }}>
          <SelectTrigger aria-label={t("filter")} className="w-full text-base data-[size=default]:h-11 md:w-auto md:text-sm md:data-[size=default]:h-10"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-56">
            {statusOptions.map(option => <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kind || ALL} items={kindOptions} modal={false} onValueChange={next => { if (typeof next === "string") navigate({ type: next === ALL ? null : next, project: null, page: null }); }}>
          <SelectTrigger aria-label={t("filterKind")} data-meeting-kind-filter className="w-full text-base data-[size=default]:h-11 md:w-auto md:text-sm md:data-[size=default]:h-10"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-56">{kindOptions.map(option => <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Link href="/calendar" className={buttonVariants({ variant: "outline", className: "h-11 border-border-strong md:h-10" })}><CalendarDays size={16} aria-hidden="true" />{tw("calendar")}</Link>
        <Select value={sort} items={sortOptions} modal={false} onValueChange={next => { if (typeof next === "string") navigate({ sort: next === "upcoming" ? null : next, page: null }); }}>
          <SelectTrigger aria-label={t("sortBy")} className="w-full text-base data-[size=default]:h-11 md:w-auto md:text-sm md:data-[size=default]:h-10"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="end">
            {sortOptions.map(option => <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {kind === "project" && projects.length > 0 && <div className="flex flex-col gap-2 sm:flex-row sm:items-center" data-meeting-kind-filters>
        <Select value={projectId || ALL} items={projectOptions} modal={false} onValueChange={next => { if (typeof next === "string") navigate({ project: next === ALL ? null : next, page: null }); }}>
          <SelectTrigger aria-label={t("filterProject")} data-meeting-project-filter className="h-11 w-full text-base sm:w-64 md:h-10 md:text-sm"><SelectValue /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false} align="start" className="min-w-56">{projectOptions.map(option => <SelectItem key={option.value} value={option.value} className="min-h-11">{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
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
    {query.isError ? <MeetingError error={query.error} retry={() => void query.refetch()} />
      : query.isPending ? <div role="status" aria-label={t("loading")} className="space-y-3">{[0, 1, 2].map(index => <Skeleton key={index} className="h-22 rounded-xl" />)}</div>
      : !total && !restorable ? <EmptyState title={t("empty")} description={t("emptyHint")} action={<Link href="/meetings/new" className={buttonVariants({ variant: "accent" })}><Plus size={16} aria-hidden="true" />{t("create")}</Link>} />
      : !arranged.length ? <div role="status" className="workspace-panel space-y-3 p-8 text-sm">
          {!showPast && !filtered && pastLoaded > 0
            ? <><p className="font-medium">{t("noUpcoming")}</p><p className="text-muted-foreground">{t("noUpcomingHint")}</p><Button variant="outline" onClick={() => navigate({ history: "1", page: null })}>{t("showHistory")}</Button></>
            : <><p className="font-medium">{t("noResults")}</p><p className="text-muted-foreground">{t("noResultsHint")}</p>
              {filtered && <Button variant="outline" onClick={() => { setSearch(""); navigate({ status: null, q: null, type: null, project: null, page: null }); }}>{t("clearFilters")}</Button>}</>}
        </div>
      : <>
        <div className="space-y-6">{groups.map(group => <section key={group.key} aria-labelledby={`meeting-group-${group.key}`} className="space-y-2.5">
          <h2 id={`meeting-group-${group.key}`} className="px-1 text-sm font-semibold text-muted-foreground">{t(`group_${group.key}`)}</h2>
          <div className="space-y-2.5">{group.meetings.map(meeting => <MeetingCard key={meeting.id} meeting={meeting} now={now}
            canEdit={canEdit(meeting)} canEnd={context.user?.id === meeting.organizerId} onAction={act} />)}</div>
        </section>)}</div>
        {query.data && !query.data.complete && <p role="status" className="text-xs text-muted-foreground">{t("listTruncated")}</p>}
        <div data-meeting-pagination className="[&_button]:min-h-11 [&_button]:min-w-11">
          <PaginationBar page={page} totalPages={totalPages} totalElements={arranged.length} pageSize={PAGE_SIZE} onPageChange={next => navigate({ page: next > 0 ? String(next + 1) : null })} />
        </div>
      </>}
  </div>;
}
