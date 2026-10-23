"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Room } from "livekit-client";
import { toast } from "sonner";
import { ArrowDown, Copy, Mic, MicOff, Search, UserPlus, VolumeX } from "lucide-react";
import { useTouchPrimaryInput } from "@/hooks/use-touch-primary-input";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { profilePhotoSrc } from "@/features/account/api";
import { COMPOSER_CHOICES, insertEmoji } from "@/features/chat/emoji-catalog";
import { EmojiPicker } from "@/features/chat/components/emoji-picker";
import { cn } from "@/lib/utils";
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

export function ParticipantsPanel({ live, room, inviteProjectId, onCopyLink, organizerId, meetingId }: {
  live: Live; room: Room | undefined;
  /** Present only for the organizer or a Project Manager: they may create guest invites. */
  inviteProjectId: string | undefined;
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
    {(inviteProjectId || onCopyLink) && <div className="flex shrink-0 flex-wrap gap-2 border-t pt-3">
      {inviteProjectId && <InviteDialog projectId={inviteProjectId} meetingId={meetingId} trigger={<Button variant="accent" className="min-h-11 flex-1 basis-32"><UserPlus size={16} aria-hidden="true" />{t("invitePeople")}</Button>} />}
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

export function ChatPanel({ live, active, content, setContent, mentions, setMentions, sending, onSend }: {
  live: Live; active: boolean; content: string; setContent: Dispatch<SetStateAction<string>>;
  mentions: string[]; setMentions: Dispatch<SetStateAction<string[]>>; sending: boolean; onSend: () => Promise<void> | void;
}) {
  const t = useTranslations("meetings"), tc = useTranslations("chat"), locale = useLocale();
  const input = useRef<HTMLTextAreaElement>(null), log = useRef<HTMLDivElement>(null), stick = useRef(true);
  const [behind, setBehind] = useState(false);
  const touch = useTouchPrimaryInput();
  const last = live.messages.at(-1);
  const groups = useMemo(() => groupMessages(live.messages), [live.messages]);
  // New messages keep the log at the bottom while the reader is there (or wrote the message); a reader further up is not yanked
  // away, and gets a "new messages" jump instead. Only the log scrolls: the page never does.
  useLayoutEffect(() => {
    const element = log.current;
    if (!element || !last) return;
    if (stick.current || last.participantId === live.selfId) { element.scrollTop = element.scrollHeight; stick.current = true; setBehind(false); }
    else setBehind(true);
  }, [last?.id, live.selfId]); // eslint-disable-line react-hooks/exhaustive-deps -- reacts to a new last message only
  useEffect(() => { if (!behind && log.current && stick.current) log.current.scrollTop = log.current.scrollHeight; }, [behind]);
  /** Sends, then puts the cursor back in the box (without scrolling the page) so the next message can follow at once. */
  async function submit() {
    await onSend();
    input.current?.focus({ preventScroll: true });
  }
  // Enter sends, Shift+Enter starts a new line. Not while an IME candidate is being confirmed, and not on touch devices,
  // where Enter on the soft keyboard stays a new line and sending goes through the button (as in task comments).
  function keyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (touch || event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (content.trim() && !sending) void submit();
  }
  const mentionQuery = /(?:^|\s)@([^@\n]*)$/.exec(content)?.[1];
  const suggestions = mentionQuery === undefined ? [] : live.participants.filter(p => p.connected && !p.revoked && p.id !== live.selfId && p.displayName.toLocaleLowerCase().includes(mentionQuery.toLocaleLowerCase())).slice(0, 8);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return <>
    <p className="mb-3 text-xs leading-5 text-muted-foreground">{t(live.retained ? "chatRetained" : "chatTemporary")}</p>
    <div className="relative min-h-0 flex-1">
      <div ref={log} role="log" aria-label={t("chat")} aria-live="polite" onScroll={event => { stick.current = nearBottom(event.currentTarget); if (stick.current) setBehind(false); }}
        className="h-full space-y-3 overflow-y-auto overscroll-contain pr-1" data-workspace-scroll>
        {live.hasOlder && <Button variant="ghost" className="compact:min-h-11" onClick={() => void live.older()?.catch(live.setError)}>{t("olderMessages")}</Button>}
        {!live.messages.length && <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{t("emptyChat")}</p>}
        {groups.map((group, index) => {
          const sender = live.participants.find(p => p.id === group.participantId), own = group.participantId === live.selfId;
          const first = group.messages[0];
          return <div key={group.key} className="space-y-3">
            {index > 0 && groups[index - 1].day !== group.day && <div role="separator" className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><time dateTime={first.sentAt}>{new Date(first.sentAt).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</time><span className="h-px flex-1 bg-border" /></div>}
            <article data-message-group={group.participantId} className="flex gap-2.5">
              <Avatar name={group.name} src={participantPhoto(sender)} tint={sender?.guest ? 2 : 0} title={false} className="mt-0.5 size-8 text-xs ring-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground"><span data-message-author className="break-words text-sm font-medium text-foreground">{group.name}{own ? ` (${t("you")})` : ""}</span><time dateTime={first.sentAt}>{time(first.sentAt)}</time></div>
                {group.messages.map(message => <div key={message.id} data-message-id={message.id}>
                  <p title={time(message.sentAt)} className={cn("w-fit max-w-full whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm leading-6", own ? "bg-meeting-soft" : "bg-muted/60", message.mentionIds.includes(live.selfId) && "ring-1 ring-meeting")}>{message.content}</p>
                  {message !== first && <time dateTime={message.sentAt} className="sr-only">{time(message.sentAt)}</time>}
                </div>)}
              </div>
            </article>
          </div>;
        })}
      </div>
      {behind && <Button type="button" size="sm" variant="accent" className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-md compact:min-h-11" onClick={() => { const element = log.current; if (element) element.scrollTop = element.scrollHeight; stick.current = true; setBehind(false); }}><ArrowDown size={14} aria-hidden="true" />{t("newMessages")}</Button>}
    </div>
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="mt-3 space-y-2 border-t pt-3">
      <label htmlFor="meeting-message" className="sr-only">{t("message")}</label>
      {/* 16px on phones: smaller text makes iOS Safari zoom the page when the field gets focus. */}
      <div className="relative">
        {/* While a message is on its way the box is read-only, not disabled: a disabled field drops focus and the next message could not be typed at once. */}
        <textarea ref={input} id="meeting-message" className="min-h-20 w-full resize-none rounded-lg border bg-background p-3 pr-12 text-sm focus-visible:outline-2 focus-visible:outline-ring compact:min-h-12 compact:text-base" maxLength={2000} value={content} onChange={event => setContent(event.target.value)} onKeyDown={keyDown} enterKeyHint={touch ? "enter" : "send"} placeholder={t("message")} disabled={!active} readOnly={sending} aria-busy={sending || undefined} />
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
      {suggestions.length > 0 && <div role="group" aria-label={t("mentions")} className="max-h-32 overflow-auto rounded-md border" data-workspace-scroll>
        {suggestions.map(p => <Button key={p.id} type="button" variant="ghost" className="min-h-11 w-full justify-start whitespace-normal" disabled={mentions.length >= 20 && !mentions.includes(p.id)}
          onClick={() => { setContent(previous => previous.replace(/@[^@\n]*$/, `@${p.displayName} `)); setMentions(previous => [...new Set([...previous, p.id])]); }}>{p.displayName}</Button>)}
      </div>}
      {mentions.length > 0 && <div className="flex flex-wrap gap-1">{mentions.map(mention => <Button key={mention} type="button" size="sm" variant="secondary" onClick={() => setMentions(previous => previous.filter(m => m !== mention))}>{live.participants.find(p => p.id === mention)?.displayName ?? t("mention")} ×</Button>)}</div>}
      <div className="flex items-center justify-between gap-2"><span className="text-xs tabular-nums text-muted-foreground">{content.length}/2000</span><Button type="submit" variant="accent" className="min-h-11" disabled={!active || sending || !content.trim()}>{t("send")}</Button></div>
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
