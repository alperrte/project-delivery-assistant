"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, CaretDown, CaretUp, MagnifyingGlass, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { chatApi } from "../api";
import { chatKeys } from "../cache";
import { formatClock, formatDayLabel } from "../format";
import { SearchHighlight, searchPreview } from "../search-text";
import type { ChatMessage } from "../types";

export type ConversationHandle = { openSearch: () => void };

export function ConversationSearchButton({ onClick, triggerRef, disabled }: {
  onClick: () => void; triggerRef: RefObject<HTMLButtonElement | null>; disabled: boolean;
}) {
  const t = useTranslations("chat.search");
  return <Tooltip><TooltipTrigger render={<Button ref={triggerRef} variant="ghost" size="icon-sm" className="size-11 shrink-0" disabled={disabled} aria-label={t("open")} data-testid="chat-search-open" onClick={onClick} />}>
    <MagnifyingGlass size={18} aria-hidden="true" />
  </TooltipTrigger><TooltipContent>{t("open")}</TooltipContent></Tooltip>;
}

export function ConversationSearch({ accountId, conversationId, onClose, onSelect, hidden }: {
  accountId: string; conversationId: string; onClose: () => void; onSelect: (id: string, signal: AbortSignal) => Promise<void>; hidden: boolean;
}) {
  const t = useTranslations("chat.search");
  const [value, setValue] = useState("");
  const [term, setTerm] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = panel.current;
    const viewport = window.visualViewport;
    if (!element || !viewport) return;
    function fitViewport() {
      if (!element || !viewport) return;
      // The software keyboard can shrink the visual viewport without resizing CSS's layout viewport.
      const narrow = (element.parentElement?.clientWidth ?? 0) < 700;
      element.style.maxHeight = narrow ? `${Math.max(120, viewport.height + viewport.offsetTop - element.getBoundingClientRect().top)}px` : "";
    }
    const observer = new ResizeObserver(fitViewport);
    if (element.parentElement) observer.observe(element.parentElement);
    viewport.addEventListener("resize", fitViewport);
    viewport.addEventListener("scroll", fitViewport);
    fitViewport();
    return () => { observer.disconnect(); viewport.removeEventListener("resize", fitViewport); viewport.removeEventListener("scroll", fitViewport); };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(value.trim()), 300);
    return () => clearTimeout(timer);
  }, [value]);
  useEffect(() => { if (!hidden) input.current?.focus(); }, [hidden]);
  const valid = value.trim() === term && term.length > 0 && [...term].length <= 200;
  return <aside ref={panel} aria-label={t("title")} data-testid="chat-search-panel"
    className={cn("chat-search-panel flex min-h-0 w-full shrink-0 flex-col bg-card @min-[700px]/chat:w-80 @min-[700px]/chat:border-l", hidden && "hidden @min-[700px]/chat:flex")}>
    <div className="flex min-h-14 shrink-0 items-center gap-2 border-b px-3">
      <Button variant="ghost" size="icon-sm" className="size-11 @min-[700px]/chat:hidden" aria-label={t("back")} onClick={onClose}><ArrowLeft size={18} aria-hidden="true" /></Button>
      <h3 className="min-w-0 flex-1 text-sm font-semibold">{t("title")}</h3>
      <Button variant="ghost" size="icon-sm" className="size-11" aria-label={t("close")} data-testid="chat-search-close" onClick={onClose}><X size={18} aria-hidden="true" /></Button>
    </div>
    <div className="relative m-3">
      <MagnifyingGlass size={18} aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3 text-muted-foreground" />
      <Input ref={input} value={value} maxLength={400} name="conversationSearch" autoComplete="off" aria-label={t("input")} placeholder={t("placeholder")} data-testid="chat-search-input"
        className="h-11 pr-12 pl-10" onChange={event => setValue(event.target.value)} />
      {!!value && <Button variant="ghost" size="icon-sm" className="absolute top-0 right-0 size-11" aria-label={t("clear")} onClick={() => { setValue(""); setTerm(""); input.current?.focus(); }}><X size={16} aria-hidden="true" /></Button>}
    </div>
    {valid ? <SearchResults key={term} accountId={accountId} conversationId={conversationId} term={term} onSelect={onSelect} /> :
      <p role="status" className="px-4 py-6 text-center text-sm text-muted-foreground">{[...value.trim()].length > 200 ? t("tooLong") : value.trim() ? t("loading") : t("start")}</p>}
  </aside>;
}

function SearchResults({ accountId, conversationId, term, onSelect }: {
  accountId: string; conversationId: string; term: string; onSelect: (id: string, signal: AbortSignal) => Promise<void>;
}) {
  const t = useTranslations("chat.search"), tc = useTranslations("chat"), locale = useLocale();
  const [selected, setSelected] = useState<string>();
  const [jumping, setJumping] = useState(false);
  const [jumpError, setJumpError] = useState(false);
  const generation = useRef({ active: true, abort: new AbortController() });
  useEffect(() => { const current = { active: true, abort: new AbortController() }; generation.current = current; return () => { current.active = false; current.abort.abort(); }; }, []);
  const query = useInfiniteQuery({
    queryKey: [...chatKeys.searchRoot(accountId, conversationId), term],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => chatApi.search(conversationId, term, pageParam, signal),
    getNextPageParam: page => (page.page + 1) * page.size < page.total ? page.page + 1 : undefined,
    gcTime: 0,
  });
  const seen = new Set<string>();
  const results = (query.data?.pages.flatMap(page => page.messages) ?? []).filter(message => {
    if (seen.has(message.id)) return false; seen.add(message.id); return true;
  });
  const total = query.data?.pages[0]?.total ?? 0;
  const index = results.findIndex(message => message.id === selected);
  async function choose(id: string) {
    if (jumping) return;
    const current = generation.current;
    setJumping(true); setJumpError(false);
    try { await onSelect(id, current.abort.signal); if (current.active) setSelected(id); }
    catch { if (current.active) setJumpError(true); }
    finally { if (current.active) setJumping(false); }
  }
  async function move(direction: number) {
    const next = index < 0 ? 0 : index + direction;
    if (next < 0 || next >= total || jumping) return;
    let result: ChatMessage | undefined = results[next];
    if (!result && query.hasNextPage && !query.isFetching) {
      const loaded = await query.fetchNextPage();
      result = loaded.data?.pages.flatMap(page => page.messages)[next];
    }
    if (result && generation.current.active) await choose(result.id);
  }
  // The sibling input participates too; attach to this conversation's search panel, never the whole document.
  const root = useRef<HTMLDivElement>(null);
  const moveRef = useRef(move);
  useEffect(() => { moveRef.current = move; });
  useEffect(() => {
    const panel = root.current?.closest("aside");
    const listener = (event: Event) => {
      const key = event as KeyboardEvent;
      if (key.key !== "Enter" || key.isComposing || key.target instanceof HTMLButtonElement) return;
      key.preventDefault(); void moveRef.current(key.shiftKey ? -1 : 1);
    };
    panel?.addEventListener("keydown", listener);
    return () => panel?.removeEventListener("keydown", listener);
  }, []);
  return <div ref={root} className="flex min-h-0 flex-1 flex-col" aria-busy={query.isFetching || jumping}>
    <div className="flex shrink-0 items-center gap-1 border-b px-3 pb-2">
      <p role="status" className="min-w-0 flex-1 text-xs text-muted-foreground tabular-nums" data-testid="chat-search-count">{t("count", { current: index + 1, total })}</p>
      <Button variant="ghost" size="icon-sm" className="size-11" aria-label={t("previous")} disabled={index <= 0 || jumping || query.isFetching} onClick={() => void move(-1)}><CaretUp size={18} aria-hidden="true" /></Button>
      <Button variant="ghost" size="icon-sm" className="size-11" aria-label={t("next")} disabled={!total || index >= total - 1 || jumping || query.isFetching} onClick={() => void move(1)}><CaretDown size={18} aria-hidden="true" /></Button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-workspace-scroll="">
      {query.isPending && <p role="status" className="p-6 text-center text-sm text-muted-foreground">{t("loading")}</p>}
      {jumping && <p role="status" className="px-4 py-2 text-sm text-muted-foreground">{t("opening")}</p>}
      {query.isError && <div role="alert" className="space-y-3 p-4 text-center text-sm"><p>{t("failed")}</p><Button variant="outline" onClick={() => void query.refetch()}>{tc("retry")}</Button></div>}
      {jumpError && <p role="alert" className="p-4 text-sm text-destructive">{t("jumpFailed")}</p>}
      {query.isSuccess && !results.length && <p role="status" className="p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}
      {results.map(message => <button key={message.id} type="button" data-testid="chat-search-result" data-result-id={message.id} aria-current={selected === message.id ? "true" : undefined}
        disabled={jumping} onClick={() => void choose(message.id)}
        className={cn("block min-h-16 w-full border-b px-4 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [content-visibility:auto] [contain-intrinsic-size:auto_6rem]", selected === message.id && "bg-primary/10")}>
        <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1"><span className="min-w-0 break-words text-xs font-semibold">{message.sender.nickname}</span>
          <time dateTime={message.createdAt} className="text-[11px] text-muted-foreground tabular-nums">{formatDayLabel(message.createdAt, locale, { today: tc("today"), yesterday: tc("yesterday") })} · {formatClock(message.createdAt, locale)}</time></span>
        <span className="mt-1 block text-sm whitespace-pre-wrap [overflow-wrap:anywhere]"><SearchHighlight text={searchPreview(message.content, term)} query={term} /></span>
      </button>)}
      {query.hasNextPage && <div className="p-3"><Button variant="outline" className="min-h-11 w-full" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? t("loading") : t("more")}</Button></div>}
    </div>
  </div>;
}
