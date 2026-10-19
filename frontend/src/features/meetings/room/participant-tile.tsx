"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { LocalParticipant, Track, type Participant } from "livekit-client";
import { MicOff } from "lucide-react";
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
  className?: string;
};

/**
 * One participant's camera (or screen share). Live video wins over the profile photo; without video the photo, then the
 * initials, fill the card. The green ring follows the browser-measured speaking state of the microphone and falls back
 * to the server's flag only where nothing could be measured.
 */
export function ParticipantTile({ participant, label, name, source = Track.Source.Camera, photoSrc, guest = false, monitor, className }: TileProps) {
  const ref = useRef<HTMLDivElement>(null);
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
  return <div data-speaking={speaking || undefined} className={cn("relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-xl border bg-surface-2 [container-type:size]", speaking && "ring-2 ring-live", className)}>
    <div ref={ref} className="absolute inset-0" />
    {!enabled && <Avatar name={name} src={photoSrc} tint={guest ? 2 : 0} title={false} className="size-[clamp(2rem,40cqh,5.5rem)] text-[clamp(0.75rem,15cqh,2rem)] ring-0" />}
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-card/90 px-3 py-1.5 text-xs sm:py-2"><span className="truncate">{label}</span>{!screen && !micOn && <MicOff size={13} className="ml-auto shrink-0" aria-hidden="true" />}</div>
  </div>;
}
