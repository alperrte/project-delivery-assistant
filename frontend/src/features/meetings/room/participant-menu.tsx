"use client";
import { createContext, useContext, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Popover } from "@base-ui/react/popover";
import { Eye, EyeOff, MicOff, MoreHorizontal, RotateCcw, UserX, Volume2, VolumeX, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { cn } from "@/lib/utils";
import { meetingsApi } from "../api";
import { DEFAULT_VOLUME, MAX_VOLUME } from "../session/volume";

/** Everything the per-participant menu may do; provided once by the room so tiles and panel rows share one source. */
export type ParticipantMenuApi = {
  volumes: Record<string, number>; muted: Record<string, boolean>;
  setVolume: (identity: string, volume: number) => void; setLocalMute: (identity: string, on: boolean) => void;
  /** True only for the meeting organizer: guests, attendees and project roles never get the moderation actions. */
  canModerate: boolean; meetingId: string;
  /** The room's participant record (id for the moderation endpoints), by LiveKit identity. */
  participantId: (identity: string) => string | undefined;
  onNotice: (message: string) => void; onFailure: (failure: unknown) => void;
  /** The participant the stage is focused on (null: automatic), and a way to change it. Absent where there is no stage. */
  focusedIdentity?: string | null; onFocus?: (identity: string | null) => void;
};
const MenuContext = createContext<ParticipantMenuApi | null>(null);
export const ParticipantMenuProvider = MenuContext.Provider;

export type MenuTarget = { identity: string; name: string; self: boolean; photoSrc?: string | null; guest?: boolean };

/**
 * A participant's menu: a right click on their card or row, the "more" button (touch and keyboard), or the context-menu key opens
 * it. It holds the local volume (0-200 %), "mute for me", focus and, for managers only, the two separate moderation actions.
 * Everything above the moderation block changes only what THIS device plays.
 */
export function ParticipantMenu({ target, children, className }: { target: MenuTarget; className?: string; children: (button: ReactNode) => ReactNode }) {
  const t = useTranslations("meetings"), api = useContext(MenuContext);
  const [open, setOpen] = useState(false), [anchor, setAnchor] = useState<Element | { getBoundingClientRect: () => DOMRect } | null>(null), [kick, setKick] = useState(false);
  const button = useRef<HTMLButtonElement>(null), volumeId = useId();
  if (!api) return <>{children(null)}</>;
  function show(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    // The context-menu key fires at (0, 0): anchor to the element then.
    const { clientX: x, clientY: y } = event;
    setAnchor(x === 0 && y === 0 ? event.currentTarget : { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) });
    setOpen(true);
  }
  const level = api.volumes[target.identity] ?? DEFAULT_VOLUME, silenced = api.muted[target.identity] ?? false;
  const participantId = api.participantId(target.identity), canModerate = api.canModerate && !target.self && !!participantId;
  const trigger = <Button ref={button} type="button" variant="ghost" aria-label={t("participantActions", { name: target.name })} aria-haspopup="dialog" aria-expanded={open}
    onClick={() => { setAnchor(button.current); setOpen(true); }}
    className={cn("size-9 shrink-0 text-muted-foreground hover:text-foreground", className)}><MoreHorizontal size={18} aria-hidden="true" /></Button>;
  return <div className="contents" onContextMenu={show}>
    {children(trigger)}
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Portal>
        <Popover.Positioner anchor={anchor} side="bottom" align="start" sideOffset={6} collisionPadding={12} className="z-50">
          <Popover.Popup aria-label={target.name} data-participant-menu={target.identity} className="max-h-(--available-height) w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl outline-none" data-workspace-scroll>
            <div className="mb-3 flex items-center gap-2.5">
              <Avatar name={target.name} src={target.photoSrc} tint={target.guest ? 2 : 0} title={false} className="size-9 text-sm ring-0" />
              <Popover.Title className="min-w-0 flex-1 break-words text-sm font-semibold">{target.name}{target.self ? ` (${t("you")})` : ""}{target.guest ? ` (${t("guest")})` : ""}</Popover.Title>
              <Popover.Close render={<Button type="button" variant="ghost" size="icon-sm" aria-label={t("closePanel")} />}><X className="size-4" aria-hidden="true" /></Popover.Close>
            </div>
            {!target.self && <section aria-label={t("volumeLabel")} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2 text-sm"><label htmlFor={volumeId} className="font-medium">{t("volumeLabel")}</label>
                <span className={cn("tabular-nums", silenced && "text-muted-foreground line-through")} data-volume-value>{level}%</span></div>
              <input id={volumeId} type="range" min={0} max={MAX_VOLUME} step={1} value={level} aria-label={t("volume")} aria-valuetext={`${level}%`} data-volume-slider
                onChange={event => api.setVolume(target.identity, Number(event.target.value))} className="w-full accent-meeting" />
              <div aria-hidden="true" className="flex justify-between text-[10px] tabular-nums text-muted-foreground"><span>0%</span><span>100%</span><span>200%</span></div>
              <p className="text-xs leading-5 text-muted-foreground">{t("volumeLocalNote")}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={silenced ? "accent" : "outline"} aria-pressed={silenced} className="min-h-10 flex-1" onClick={() => api.setLocalMute(target.identity, !silenced)}>
                  {silenced ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}{t(silenced ? "unmuteForMe" : "muteForMe")}</Button>
                <Button type="button" variant="ghost" className="min-h-10" disabled={level === DEFAULT_VOLUME && !silenced} onClick={() => { api.setLocalMute(target.identity, false); api.setVolume(target.identity, DEFAULT_VOLUME); }}>
                  <RotateCcw size={15} aria-hidden="true" />{t("volumeReset")}</Button>
              </div>
            </section>}
            {api.onFocus && <div className={cn(!target.self && "mt-3 border-t pt-3")}>
              {api.focusedIdentity === target.identity
                ? <Button type="button" variant="outline" className="min-h-10 w-full" onClick={() => { api.onFocus?.(null); setOpen(false); }}><EyeOff size={16} aria-hidden="true" />{t("autoFocus")}</Button>
                : <Button type="button" variant="outline" className="min-h-10 w-full" onClick={() => { api.onFocus?.(target.identity); setOpen(false); }}><Eye size={16} aria-hidden="true" />{t("focusParticipant")}</Button>}
            </div>}
            {canModerate && <section aria-label={t("moderation")} className="mt-3 space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">{t("moderation")}</p>
              <Button type="button" variant="outline" className="min-h-10 w-full justify-start" onClick={async () => {
                setOpen(false);
                try { await meetingsApi.moderate(api.meetingId, participantId!, "mute"); api.onNotice(t("muted")); } catch (failure) { api.onFailure(failure); }
              }}><MicOff size={16} aria-hidden="true" />{t("muteParticipant")}</Button>
              <Button type="button" variant="ghost" className="min-h-10 w-full justify-start text-destructive" onClick={() => { setOpen(false); setKick(true); }}><UserX size={16} aria-hidden="true" />{t("kick")}</Button>
            </section>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    {canModerate && <ConfirmDialog open={kick} onOpenChange={setKick} title={t("kick")} description={t("kickConfirm")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} destructive
      onConfirm={async () => { await meetingsApi.moderate(api.meetingId, participantId!, "kick"); api.onNotice(t("rotationNotice")); }} />}
  </div>;
}
