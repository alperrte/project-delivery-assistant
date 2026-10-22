"use client";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LocalParticipant, Track, type Participant } from "livekit-client";
import { Mic, MicOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { SpeakerMonitor } from "./speaker-monitor";

type TileProps = {
  participant: Participant;
  label: string;
  /** Name used for the initials fallback. */
  name: string;
  source?: Track.Source;
  /** PDA profile photo; null shows initials (members without a photo, guests, or a photo that fails to load). */
  photoSrc?: string | null;
  guest?: boolean;
  monitor: SpeakerMonitor;
  /** This feed is the one the stage shows (or the one picked in the strip): a blue border marks it. */
  selected?: boolean;
  /** The strip's small card: a one-line name and no centre avatar growth. */
  compact?: boolean;
  className?: string;
  /** Controls laid over the card (focus button, menu). They must carry their own positioning and stacking. */
  children?: ReactNode;
};

/**
 * One participant's camera (or screen share). Live video wins over the profile photo; without video the photo, then the
 * initials, fill the card. The blue ring follows the browser-measured speaking state of the microphone and falls back
 * to the server's flag only where nothing could be measured. The microphone state is an icon, never only a colour.
 */
export function ParticipantTile({ participant, label, name, source = Track.Source.Camera, photoSrc, guest = false, monitor, selected = false, compact = false, className, children }: TileProps) {
  const t = useTranslations("meetings"), ref = useRef<HTMLDivElement>(null);
  const screen = source === Track.Source.ScreenShare;
  const track = participant.getTrackPublication(source)?.track;
  const enabled = Boolean(track) && !track?.isMuted;
  const measured = useSyncExternalStore(monitor.subscribe, () => monitor.snapshot(participant.identity), () => -1);
  const micOn = participant.isMicrophoneEnabled;
  const speaking = !screen && micOn && (measured === 1 || (measured === -1 && participant.isSpeaking));
  useEffect(() => {
    if (!track || !enabled || !ref.current) return;
    const element = track.attach();
    element.className = cn("h-full w-full", screen ? "object-contain" : "object-cover");
    if (element instanceof HTMLVideoElement) { element.playsInline = true; element.muted = participant instanceof LocalParticipant; }
    ref.current.appendChild(element);
    return () => { track.detach(element); element.remove(); };
  }, [track, enabled, participant, screen]);
  return <div data-speaking={speaking || undefined} data-selected={selected || undefined}
    className={cn("relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-xl border bg-surface-2 @container-size", (speaking || selected) && "border-meeting ring-2 ring-meeting", className)}>
    <div ref={ref} className={cn("absolute inset-0", screen && "bg-black")} />
    {!enabled && <Avatar name={name} src={photoSrc} tint={guest ? 2 : 0} title={false} className="size-[clamp(2rem,40cqh,5.5rem)] text-[clamp(0.75rem,15cqh,2rem)] ring-0" />}
    <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/60 px-2.5 text-white", compact ? "py-1 text-xs" : "py-2 text-sm")}>
      <span className="truncate font-medium">{label}</span>
      {!screen && (micOn
        ? <span className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-white/20"><Mic size={12} aria-hidden="true" /><span className="sr-only">{t("micStatusOn")}</span></span>
        : <span className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-destructive text-white"><MicOff size={12} aria-hidden="true" /><span className="sr-only">{t("micStatusOff")}</span></span>)}
    </div>
    {children}
  </div>;
}
