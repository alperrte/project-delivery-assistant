"use client";
import { useRef, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import type { Room } from "livekit-client";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { profilePhotoSrc } from "@/features/account/api";
import { COMPOSER_CHOICES, insertEmoji } from "@/features/chat/emoji-catalog";
import { EmojiPicker } from "@/features/chat/components/emoji-picker";
import { meetingsApi } from "../api";
import type { MeetingParticipant } from "../types";
import type { SessionLive } from "../session/meeting-session";

type Live = SessionLive;

export function participantPhoto(view: MeetingParticipant | undefined): string | null {
  return view?.userId ? profilePhotoSrc(view.userId, view.profilePhotoVersion) : null;
}

export function ParticipantsPanel({ live, volumes, onVolume, managerProjectId, meetingId, onNotice }: {
  live: Live; volumes: Record<string, number>; onVolume: (identity: string, volume: number) => void;
  /** Present only for a Project Manager; guests and members never get moderation controls. */
  managerProjectId: string | undefined; meetingId: string; onNotice: (message: string) => void;
}) {
  const t = useTranslations("meetings");
  return <ul className="space-y-4 overflow-y-auto">
    {live.participants.filter(p => !p.revoked && (p.connected || p.id === live.selfId)).map(p => <li key={p.id} className="space-y-2 border-t pt-3">
      <div className="flex items-center gap-3">
        <Avatar name={p.displayName} src={participantPhoto(p)} tint={p.guest ? 2 : 0} title={false} className="size-9 text-sm" />
        <p className="min-w-0 break-words text-sm font-medium">{p.displayName}{p.id === live.selfId ? ` (${t("you")})` : ""}{p.guest ? ` (${t("guest")})` : ""}</p>
      </div>
      {p.id !== live.selfId && <>
        <label className="block space-y-2 text-xs text-muted-foreground">{t("volume")}
          <input className="w-full accent-primary" type="range" min={0} max={100} value={volumes[p.identity] ?? 100}
            onChange={event => onVolume(p.identity, Number(event.target.value))} />
        </label>
        {managerProjectId && <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="compact:min-h-11" onClick={async () => { try { await meetingsApi.moderate(managerProjectId, meetingId, p.id, "mute"); onNotice(t("muted")); } catch (failure) { live.setError(failure); } }}>{t("muteParticipant")}</Button>
          <ConfirmDialog trigger={<Button size="sm" variant="ghost" className="text-destructive compact:min-h-11">{t("kick")}</Button>} title={t("kick")} description={t("kickConfirm")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} destructive
            onConfirm={async () => { await meetingsApi.moderate(managerProjectId, meetingId, p.id, "kick"); onNotice(t("rotationNotice")); }} />
        </div>}
      </>}
    </li>)}
  </ul>;
}

export function ChatPanel({ live, active, content, setContent, mentions, setMentions, sending, onSend }: {
  live: Live; active: boolean; content: string; setContent: Dispatch<SetStateAction<string>>;
  mentions: string[]; setMentions: Dispatch<SetStateAction<string[]>>; sending: boolean; onSend: () => void;
}) {
  const t = useTranslations("meetings"), tc = useTranslations("chat");
  const input = useRef<HTMLTextAreaElement>(null);
  const mentionQuery = /(?:^|\s)@([^@\n]*)$/.exec(content)?.[1];
  const suggestions = mentionQuery === undefined ? [] : live.participants.filter(p => p.connected && !p.revoked && p.id !== live.selfId && p.displayName.toLocaleLowerCase().includes(mentionQuery.toLocaleLowerCase())).slice(0, 8);
  return <>
    <p className="mb-3 text-xs leading-5 text-muted-foreground">{t(live.retained ? "chatRetained" : "chatTemporary")}</p>
    <div role="log" aria-label={t("chat")} aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
      {live.hasOlder && <Button variant="ghost" className="compact:min-h-11" onClick={() => void live.older()?.catch(live.setError)}>{t("olderMessages")}</Button>}
      {!live.messages.length && <p className="text-sm text-muted-foreground">{t("emptyChat")}</p>}
      {live.messages.map(message => <article key={message.id} className={`rounded-lg p-3 ${message.mentionIds.includes(live.selfId) ? "border border-primary/40 bg-primary/10" : "bg-muted/50"}`}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="break-words font-medium text-foreground">{message.displayName}</span><time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time></div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
      </article>)}
    </div>
    <form onSubmit={event => { event.preventDefault(); onSend(); }} className="mt-3 space-y-2 border-t pt-3">
      <label htmlFor="meeting-message" className="sr-only">{t("message")}</label>
      {/* 16px on phones: smaller text makes iOS Safari zoom the page when the field gets focus. */}
      <div className="relative">
        <textarea ref={input} id="meeting-message" className="min-h-20 w-full resize-y rounded-md border bg-background p-3 pr-12 text-sm focus-visible:outline-2 focus-visible:outline-ring compact:min-h-12 compact:text-base" maxLength={2000} value={content} onChange={event => setContent(event.target.value)} disabled={!active || sending} />
        <div className="absolute right-1 bottom-1">
          {/* The chat's own emoji picker; the caret position and surrogate pairs are handled by `insertEmoji`. */}
          <EmojiPicker choices={COMPOSER_CHOICES} label={tc("emoji.action")} testId="meeting-chat-emoji" disabled={!active || sending} finalFocus={input}
            onChoose={choice => {
              const field = input.current;
              const inserted = insertEmoji(content, field?.selectionStart ?? content.length, field?.selectionEnd ?? content.length, choice.emoji);
              if (inserted.text.length > 2000) { toast.error(tc("validation.tooLong", { max: 2000 })); return; }
              setContent(inserted.text);
              requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(inserted.caret, inserted.caret); });
            }} />
        </div>
      </div>
      {suggestions.length > 0 && <div role="group" aria-label={t("mentions")} className="max-h-32 overflow-auto rounded-md border">
        {suggestions.map(p => <Button key={p.id} type="button" variant="ghost" className="min-h-11 w-full justify-start whitespace-normal" disabled={mentions.length >= 20 && !mentions.includes(p.id)}
          onClick={() => { setContent(previous => previous.replace(/@[^@\n]*$/, `@${p.displayName} `)); setMentions(previous => [...new Set([...previous, p.id])]); }}>{p.displayName}</Button>)}
      </div>}
      {mentions.length > 0 && <div className="flex flex-wrap gap-1">{mentions.map(mention => <Button key={mention} type="button" size="sm" variant="secondary" onClick={() => setMentions(previous => previous.filter(m => m !== mention))}>{live.participants.find(p => p.id === mention)?.displayName ?? t("mention")} ×</Button>)}</div>}
      <div className="flex items-center justify-between gap-2"><span className="text-xs tabular-nums text-muted-foreground">{content.length}/2000</span><Button type="submit" className="min-h-11" disabled={!active || sending || !content.trim()}>{t("send")}</Button></div>
    </form>
  </>;
}

export function DevicesPanel({ room, devices, onSwitch }: { room: Room | undefined; devices: MediaDeviceInfo[]; onSwitch: (kind: MediaDeviceKind, deviceId: string) => void }) {
  const t = useTranslations("meetings");
  return <div className="space-y-4 overflow-y-auto">
    {(["audioinput", "videoinput", "audiooutput"] as const).map(kind => <label key={kind} className="block space-y-2 text-sm">{t(kind)}
      <select className="min-h-11 w-full rounded-md border bg-background px-3 text-sm compact:text-base" defaultValue={room?.getActiveDevice(kind)} onChange={event => onSwitch(kind, event.target.value)}>
        <option value="default">{t("defaultDevice")}</option>
        {devices.filter(d => d.kind === kind && d.deviceId && d.deviceId !== "default").map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t(kind)} ${i + 1}`}</option>)}
      </select>
    </label>)}
    <p className="text-xs leading-5 text-muted-foreground">{t("deviceHint")}</p>
  </div>;
}
