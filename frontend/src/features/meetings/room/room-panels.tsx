"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Room } from "livekit-client";
import { toast } from "sonner";
import { ArrowDown, Copy, CornerUpLeft, Mic, MicOff, Search, UserPlus, VolumeX, X } from "lucide-react";
import { useTouchPrimaryInput } from "@/hooks/use-touch-primary-input";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { profilePhotoSrc } from "@/features/account/api";
import { COMPOSER_CHOICES, insertEmoji } from "@/features/chat/emoji-catalog";
import { EmojiPicker } from "@/features/chat/components/emoji-picker";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./chat-message";
import { DeviceSelect } from "./device-select";
import { InviteDialog } from "./invite-dialog";
import { ParticipantMenu } from "./participant-menu";
import { DEFAULT_VOLUME } from "../session/volume";
import { CAPTURE_KEYS, type CaptureKey, type CaptureSettings } from "../use-meeting-room";
import type { MeetingMessage, MeetingParticipant } from "../types";
import type { SessionLive } from "../session/meeting-session";

type Live = SessionLive;

export function participantPhoto(view: MeetingParticipant | undefined): string | null {
  return view?.userId ? profilePhotoSrc(view.userId, view.profilePhotoVersion) : null;
}

export function ParticipantsPanel({ live, room, canInvite, onCopyLink, organizerId, meetingId }: {
  live: Live; room: Room | undefined;
  /** Present only for the organizer or a Project Manager: they may create guest invites. */
  canInvite: boolean;
  /** Present only inside a project (guests have no meeting page to link to). */
  onCopyLink: (() => void) | undefined;
  organizerId: string | undefined; meetingId: string;
}) {
  const t = useTranslations("meetings");
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase();
  const present = live.participants.filter(p => !p.revoked && (p.connected || p.id === live.selfId));
  const shown = present.filter(p => !needle || p.displayName.toLocaleLowerCase().includes(needle));
  const micOf = (identity: string) => { const person = room?.localParticipant.identity === identity ? room.localParticipant : room?.remoteParticipants.get(identity); return Boolean(person?.isMicrophoneEnabled); };
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="relative">
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label={t("searchParticipants")} placeholder={t("searchParticipants")} className="h-11 pl-9 text-base md:h-10 md:text-sm" />
    </div>
    <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain" data-workspace-scroll>
      {shown.map(p => {
        const mic = micOf(p.identity), organizer = !!organizerId && p.userId === organizerId, self = p.id === live.selfId;
        const level = live.volumes[p.identity] ?? DEFAULT_VOLUME, silenced = live.muted[p.identity] ?? false;
        return <li key={p.id} data-participant={p.identity}>
          <ParticipantMenu target={{ identity: p.identity, name: p.displayName, self, photoSrc: participantPhoto(p), guest: p.guest }}>
            {menu => <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
              <Avatar name={p.displayName} src={participantPhoto(p)} tint={p.guest ? 2 : 0} title={false} className="size-9 text-sm ring-0" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{p.displayName}{self ? ` (${t("you")})` : ""}{p.guest ? ` (${t("guest")})` : ""}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {organizer && <span className="inline-block rounded-full bg-meeting-soft px-2 py-0.5 text-xs font-medium text-meeting-ink">{t("organizer")}</span>}
                  {silenced ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"><VolumeX size={11} aria-hidden="true" />{t("mutedForMe")}</span>
                    : !self && level !== DEFAULT_VOLUME && <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{level}%</span>}
                </div>
              </div>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", mic ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive")}>
                {mic ? <Mic size={14} aria-hidden="true" /> : <MicOff size={14} aria-hidden="true" />}<span className="sr-only">{t(mic ? "micStatusOn" : "micStatusOff")}</span>
              </span>
              {menu}
            </div>}
          </ParticipantMenu>
        </li>;
      })}
      {!shown.length && <li className="px-2 py-3 text-sm text-muted-foreground">{t("noParticipantsFound")}</li>}
    </ul>
    {(canInvite || onCopyLink) && <div className="flex shrink-0 flex-wrap gap-2 border-t pt-3">
      {canInvite && <InviteDialog meetingId={meetingId} trigger={<Button variant="default" className="min-h-11 flex-1 basis-32"><UserPlus size={16} aria-hidden="true" />{t("invitePeople")}</Button>} />}
      {onCopyLink && <Button variant="outline" className="min-h-11 flex-1 basis-32" onClick={onCopyLink}><Copy size={16} aria-hidden="true" />{t("copy")}</Button>}
    </div>}
  </div>;
}

const nearBottom = (element: HTMLElement) => element.scrollHeight - element.scrollTop - element.clientHeight < 96;
const dayOf = (iso: string) => { const date = new Date(iso); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; };

/**
 * Consecutive messages of the same person (by participant id, never by display name) on the same day form one group: the avatar, the
 * name and the time appear once, every message keeps its own bubble. A new day starts a new group with a date divider.
 */
export function groupMessages(messages: MeetingMessage[]) {
  const groups: { key: string; participantId: string; name: string; day: string; messages: MeetingMessage[] }[] = [];
  for (const message of messages) {
    const day = dayOf(message.sentAt), last = groups.at(-1);
    if (last && last.participantId === message.participantId && last.day === day) last.messages.push(message);
    else groups.push({ key: message.id, participantId: message.participantId, name: message.displayName, day, messages: [message] });
  }
  return groups;
}

/** The mention being typed at the caret: where its "@" is and what follows it (spaces allowed, so "@Alper Te" keeps narrowing). */
export function mentionToken(text: string, caret: number) {
  const found = /(?:^|\s)@([^@\n]*)$/.exec(text.slice(0, caret));
  return found ? { start: found.index + found[0].length - found[1].length - 1, query: found[1] } : null;
}
const flat = (text: string, max: number) => { const value = text.replace(/\s+/g, " ").trim(); return value.length > max ? `${value.slice(0, max)}…` : value; };

export function ChatPanel({ live, active, content, setContent, mentions, setMentions, sending, onSend }: {
  live: Live; active: boolean; content: string; setContent: Dispatch<SetStateAction<string>>;
  mentions: string[]; setMentions: Dispatch<SetStateAction<string[]>>; sending: boolean;
  /** Sends the message (answering `replyToMessageId` when given); true when it was sent, so the reply draft can be dropped. */
  onSend: (replyToMessageId?: string) => Promise<boolean | void> | boolean | void;
}) {
  const t = useTranslations("meetings"), tc = useTranslations("chat"), locale = useLocale();
  const input = useRef<HTMLTextAreaElement>(null), log = useRef<HTMLDivElement>(null), list = useRef<HTMLDivElement>(null), stick = useRef(true);
  const picker = useRef<HTMLElement | null>(null);
  const [behind, setBehind] = useState(false);
  const [reply, setReply] = useState<MeetingMessage | null>(null);
  const [reacting, setReacting] = useState<MeetingMessage | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null), [jumpTo, setJumpTo] = useState<string | null>(null);
  const [caret, setCaret] = useState(0), [dismissed, setDismissed] = useState<string | null>(null), [choice, setChoice] = useState({ key: "", index: 0 });
  const touch = useTouchPrimaryInput();
  const last = live.messages.at(-1);
  const groups = useMemo(() => groupMessages(live.messages), [live.messages]);
  // A new message is said once, as "name: text" (or "message sent" for your own), through its own polite status. The log itself is not live: when it was, the
  // reader read every new bubble out with its Reply and Emoji buttons, and the avatar's initials, which only cluttered what had been said.
  const [said, setSaid] = useState<{ ready: boolean; id?: string; text: string }>({ ready: false, text: "" });
  if (live.chatLoaded && !said.ready) setSaid({ ready: true, id: last?.id, text: "" });
  else if (said.ready && last && last.id !== said.id) setSaid({ ready: true, id: last.id, text: last.participantId === live.selfId ? t("messageSent") : t("messageFrom", { name: last.displayName, text: flat(last.content, 300) }) });
  // New messages keep the log at the bottom while the reader is there (or wrote the message); a reader further up is not yanked
  // away, and gets a "new messages" jump instead. Only the log scrolls: the page never does.
  useLayoutEffect(() => {
    const element = log.current;
    if (!element || !last) return;
    if (stick.current || last.participantId === live.selfId) { element.scrollTop = element.scrollHeight; stick.current = true; setBehind(false); }
    else setBehind(true);
  }, [last?.id, live.selfId]); // eslint-disable-line react-hooks/exhaustive-deps -- reacts to a new last message only
  useEffect(() => { if (!behind && log.current && stick.current) log.current.scrollTop = log.current.scrollHeight; }, [behind]);

  // Mentions: the token at the caret decides the list; ArrowUp/Down move in it, Enter chooses (it never sends), Escape closes it.
  const token = mentionToken(content, caret), tokenKey = token ? `${token.start}:${token.query}` : "";
  const suggestions = token && dismissed !== tokenKey
    ? live.participants.filter(p => p.connected && !p.revoked && p.id !== live.selfId && p.displayName.toLocaleLowerCase().includes(token.query.toLocaleLowerCase())).slice(0, 8)
    : [];
  const activeIndex = suggestions.length ? Math.min(choice.key === tokenKey ? choice.index : 0, suggestions.length - 1) : -1;
  const optionId = (id: string) => `meeting-mention-${id}`;
  useEffect(() => {
    if (activeIndex < 0 || !list.current) return;
    const item = list.current.querySelector<HTMLElement>(`#${CSS.escape(optionId(suggestions[activeIndex].id))}`), box = list.current;
    if (!item) return;
    if (item.offsetTop < box.scrollTop) box.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = item.offsetTop + item.offsetHeight - box.clientHeight;
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps -- the list itself changes with the query, which resets the index
  function chooseMention(participant: MeetingParticipant | undefined) {
    if (!token || !participant || (mentions.length >= 20 && !mentions.includes(participant.id))) return;
    const insert = `@${participant.displayName} `, position = token.start + insert.length;
    setContent(content.slice(0, token.start) + insert + content.slice(caret));
    setMentions(previous => [...new Set([...previous, participant.id])]);
    setCaret(position);
    requestAnimationFrame(() => { input.current?.focus({ preventScroll: true }); input.current?.setSelectionRange(position, position); });
  }

  /** Sends, then puts the cursor back in the box (without scrolling the page) so the next message can follow at once. */
  async function submit() {
    const sent = await onSend(reply?.id);
    if (sent === true) setReply(null);
    input.current?.focus({ preventScroll: true });
  }
  // Enter sends, Shift+Enter starts a new line. Not while an IME candidate is being confirmed, and not on touch devices,
  // where Enter on the soft keyboard stays a new line and sending goes through the button (as in task comments).
  function keyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (suggestions.length) {
      const move = (step: number) => { event.preventDefault(); setChoice({ key: tokenKey, index: (activeIndex + step + suggestions.length) % suggestions.length }); };
      if (event.key === "ArrowDown") { move(1); return; }
      if (event.key === "ArrowUp") { move(-1); return; }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDismissed(tokenKey); return; } // the panel itself must stay open
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); chooseMention(suggestions[activeIndex]); return; }
    } else if (event.key === "Escape" && reply) { event.preventDefault(); event.stopPropagation(); setReply(null); return; }
    if (touch || event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    if (content.trim() && !sending) void submit();
  }

  const startReply = (message: MeetingMessage) => { setReply(message); requestAnimationFrame(() => input.current?.focus({ preventScroll: true })); };
  const toggle = (message: MeetingMessage, emoji: string) => {
    const mine = message.reactions?.find(r => r.emoji === emoji)?.reactedByMe ?? false;
    live.react(message.id, emoji, !mine).catch(() => toast.error(t("reactionFailed")));
  };
  /** Brings an answered message into the list if it is older than what is loaded, then scrolls the CHAT (never the page) to it. */
  async function goTo(messageId: string) {
    if (!(await live.ensureMessage(messageId))) { toast.info(t("replyNotReachable")); return; }
    setJumpTo(messageId);
  }
  useEffect(() => {
    if (!jumpTo) return;
    const box = log.current, target = box?.querySelector<HTMLElement>(`[data-message-id="${jumpTo}"]`);
    if (!box || !target) return;
    setJumpTo(null); stick.current = false;
    const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - (box.clientHeight - target.clientHeight) / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    target.focus({ preventScroll: true }); setHighlighted(jumpTo);
  }, [jumpTo, live.messages]);
  // The highlight is brief and has no animation: it just goes after a moment.
  useEffect(() => {
    if (!highlighted) return;
    const timer = setTimeout(() => setHighlighted(null), 1800);
    return () => clearTimeout(timer);
  }, [highlighted]);

  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return <>
    <p className="mb-3 text-xs leading-5 text-muted-foreground">{t(live.retained ? "chatRetained" : "chatTemporary")}</p>
    <p role="status" className="sr-only">{said.text}</p>
    <div className="relative min-h-0 flex-1">
      <div ref={log} role="log" aria-label={t("chat")} aria-live="off" onScroll={event => { stick.current = nearBottom(event.currentTarget); if (stick.current) setBehind(false); }}
        className="relative h-full space-y-3 overflow-y-auto overscroll-contain pr-1" data-workspace-scroll>
        {live.hasOlder && <Button variant="ghost" className="compact:min-h-11" onClick={() => void live.older()?.catch(live.setError)}>{t("olderMessages")}</Button>}
        {!live.messages.length && <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{t("emptyChat")}</p>}
        {groups.map((group, index) => {
          const sender = live.participants.find(p => p.id === group.participantId), own = group.participantId === live.selfId;
          const first = group.messages[0];
          return <div key={group.key} className="space-y-3">
            {index > 0 && groups[index - 1].day !== group.day && <div role="separator" className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><time dateTime={first.sentAt}>{new Date(first.sentAt).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</time><span className="h-px flex-1 bg-border" /></div>}
            <article data-message-group={group.participantId} className="flex gap-2.5">
              <span aria-hidden="true" className="contents"><Avatar name={group.name} src={participantPhoto(sender)} tint={sender?.guest ? 2 : 0} title={false} className="mt-0.5 size-8 text-xs ring-0" /></span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground"><span data-message-author className="break-words text-sm font-medium text-foreground">{group.name}{own ? ` (${t("you")})` : ""}</span><span className="sr-only">, </span><time dateTime={first.sentAt}>{time(first.sentAt)}</time><span className="sr-only">. </span></div>
                {group.messages.map(message => <ChatMessage key={message.id} message={message} selfId={live.selfId} own={own} continued={message !== first} highlighted={highlighted === message.id} time={time(message.sentAt)}
                  onReply={startReply} onToggle={toggle} onJump={id => void goTo(id)}
                  onOpenPicker={(target, anchor) => { picker.current = anchor; setReacting(target); }} />)}
              </div>
            </article>
          </div>;
        })}
      </div>
      {behind && <Button type="button" size="sm" variant="default" className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-md compact:min-h-11" onClick={() => { const element = log.current; if (element) element.scrollTop = element.scrollHeight; stick.current = true; setBehind(false); }}><ArrowDown size={14} aria-hidden="true" />{t("newMessages")}</Button>}
    </div>
    {/* One picker for every message: it opens next to the button of the message that asked, and a choice adds (or takes back) that emoji. */}
    <EmojiPicker choices={COMPOSER_CHOICES} label={t("reactAction")} testId="meeting-reaction-picker" showTrigger={false} anchorRef={picker} open={!!reacting}
      onOpenChange={open => { if (!open) setReacting(null); }} onChoose={choiceMade => { if (reacting) toggle(reacting, choiceMade.emoji); }} />
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="mt-3 space-y-2 border-t pt-3">
      {reply && <div data-reply-draft className="flex items-start gap-2 rounded-lg border-l-2 border-meeting bg-muted/50 py-1.5 pr-1 pl-3 text-xs">
        <CornerUpLeft size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{t("replyingTo", { name: reply.participantId === live.selfId ? t("you") : reply.displayName })}</p><p className="line-clamp-2 break-words text-muted-foreground">{flat(reply.content, 140)}</p></div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("replyCancel")} title={t("replyCancel")} className="shrink-0 [@media(pointer:coarse)]:size-11" onClick={() => { setReply(null); input.current?.focus({ preventScroll: true }); }}><X size={14} aria-hidden="true" /></Button>
      </div>}
      <label htmlFor="meeting-message" className="sr-only">{t("message")}</label>
      {/* 16px on phones: smaller text makes iOS Safari zoom the page when the field gets focus. */}
      <div className="relative">
        {/* Keep the pending draft read-only and focused so success cannot erase new keystrokes.
            Do not mark this focused textbox busy: delivery is announced by the existing status/error regions. */}
        <textarea ref={input} id="meeting-message" className="min-h-20 w-full resize-none rounded-lg border bg-background p-3 pr-12 text-sm focus-visible:outline-2 focus-visible:outline-ring compact:min-h-12 compact:text-base" maxLength={2000} value={content}
          onChange={event => { setContent(event.target.value); setCaret(event.target.selectionStart); }} onSelect={event => setCaret(event.currentTarget.selectionStart)} onKeyDown={keyDown}
          aria-autocomplete="list" aria-controls={suggestions.length ? "meeting-mention-list" : undefined} aria-activedescendant={activeIndex >= 0 ? optionId(suggestions[activeIndex].id) : undefined}
          enterKeyHint={touch ? "enter" : "send"} placeholder={t("message")} disabled={!active} readOnly={sending} />
        <div className="absolute right-1 bottom-1">
          {/* The chat's own emoji picker; the caret position and surrogate pairs are handled by `insertEmoji`. */}
          <EmojiPicker choices={COMPOSER_CHOICES} label={tc("emoji.action")} testId="meeting-chat-emoji" disabled={!active || sending} finalFocus={input}
            onChoose={choice => {
              const field = input.current;
              const inserted = insertEmoji(content, field?.selectionStart ?? content.length, field?.selectionEnd ?? content.length, choice.emoji);
              if (inserted.text.length > 2000) { toast.error(tc("validation.tooLong", { max: 2000 })); return; }
              setContent(inserted.text);
              requestAnimationFrame(() => { input.current?.focus({ preventScroll: true }); input.current?.setSelectionRange(inserted.caret, inserted.caret); });
            }} />
        </div>
      </div>
      {/* The field stays a plain text box (a textarea cannot carry the combobox role); the list is announced through the active option and this status. */}
      <div role="status" className="sr-only">{suggestions.length ? t("mentionResults", { count: suggestions.length }) : ""}</div>
      {suggestions.length > 0 && <div ref={list} id="meeting-mention-list" role="listbox" aria-label={t("mentions")} className="relative max-h-40 overflow-auto rounded-md border" data-workspace-scroll>
        {suggestions.map((p, index) => {
          const full = mentions.length >= 20 && !mentions.includes(p.id), duplicate = suggestions.some(other => other.id !== p.id && other.displayName === p.displayName);
          return <div key={p.id} id={optionId(p.id)} role="option" aria-selected={index === activeIndex} aria-disabled={full || undefined} data-mention-option={p.id}
            onMouseDown={event => event.preventDefault()} onClick={() => chooseMention(p)} onMouseMove={() => { if (index !== activeIndex) setChoice({ key: tokenKey, index }); }}
            className={cn("flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm", index === activeIndex && "bg-muted", full && "cursor-not-allowed opacity-50")}>
            <span className="min-w-0 flex-1 break-words">{p.displayName}</span>
            {(p.guest || duplicate) && <span className="shrink-0 text-xs text-muted-foreground">{p.guest ? t("guestTag") : ""}{duplicate ? ` #${index + 1}` : ""}</span>}
          </div>;
        })}
      </div>}
      {mentions.length > 0 && <div className="flex flex-wrap gap-1">{mentions.map(mention => <Button key={mention} type="button" size="sm" variant="secondary" onClick={() => setMentions(previous => previous.filter(m => m !== mention))}>{live.participants.find(p => p.id === mention)?.displayName ?? t("mention")} ×</Button>)}</div>}
      <div className="flex items-center justify-between gap-2"><span className="text-xs tabular-nums text-muted-foreground">{content.length}/2000</span><Button type="submit" variant="default" className="min-h-11" disabled={!active || sending || !content.trim()}>{t("send")}</Button></div>
    </form>
  </>;
}

export function DevicesPanel({ room, devices, onSwitch, capture }: {
  room: Room | undefined; devices: MediaDeviceInfo[]; onSwitch: (kind: MediaDeviceKind, deviceId: string) => void;
  /** The browser's own microphone processing: what is on, and which of it this browser can really switch. */
  capture: { values: CaptureSettings; support: Record<CaptureKey, boolean>; onChange: (key: CaptureKey, enabled: boolean) => void };
}) {
  const t = useTranslations("meetings");
  // The choice per kind, started from the device the room has open; the room confirms it by switching.
  const [chosen, setChosen] = useState<Partial<Record<MediaDeviceKind, string>>>(() => ({ audioinput: room?.getActiveDevice("audioinput"), videoinput: room?.getActiveDevice("videoinput"), audiooutput: room?.getActiveDevice("audiooutput") }));
  return <div className="space-y-4 overflow-y-auto" data-workspace-scroll>
    {(["audioinput", "videoinput", "audiooutput"] as const).map(kind => <DeviceSelect key={kind} kind={kind} devices={devices} value={chosen[kind] === "default" ? "" : chosen[kind] ?? ""}
      onChange={deviceId => { setChosen(previous => ({ ...previous, [kind]: deviceId })); onSwitch(kind, deviceId || "default"); }} />)}
    <fieldset className="space-y-2" data-capture-settings>
      <legend className="mb-1 text-sm font-medium">{t("captureTitle")}</legend>
      {CAPTURE_KEYS.map(key => {
        const supported = capture.support[key];
        return <label key={key} className={cn("flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm", supported ? "cursor-pointer" : "cursor-not-allowed opacity-70")}>
          <Checkbox checked={supported && capture.values[key]} disabled={!supported} onCheckedChange={enabled => capture.onChange(key, enabled)} className="mt-0.5" data-capture={key} />
          <span className="space-y-0.5"><span className="block font-medium">{t(key)}</span>
            <span className="block text-xs leading-5 text-muted-foreground">{t(supported ? `${key}Hint` : "captureUnsupported")}</span></span>
        </label>;
      })}
      <p className="text-xs leading-5 text-muted-foreground">{t("captureNote")}</p>
    </fieldset>
    <p className="text-xs leading-5 text-muted-foreground">{t("deviceHint")}</p>
  </div>;
}
