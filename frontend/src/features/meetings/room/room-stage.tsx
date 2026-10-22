"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Track, type Participant } from "livekit-client";
import { Expand, LayoutGrid, Minimize2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ParticipantTile } from "./participant-tile";
import type { SpeakerMonitor } from "./speaker-monitor";

/** What the person picked to look at; local layout only, it never touches the call. */
export type StageFocus = { kind: "screen" | "camera"; identity: string };
export type StageMode = "focus" | "grid";
type Described = { name: string; label: string; photoSrc: string | null; guest: boolean };

/**
 * The feed the stage shows. A pick wins while it is still valid (the person is still here, the share still runs); otherwise
 * the stage falls back on its own: a running screen share first, then the first remote participant, then yourself.
 */
export function resolveStage(people: Participant[], shares: Participant[], pick: StageFocus | null): StageFocus | null {
  if (pick?.kind === "screen" && shares.some(p => p.identity === pick.identity)) return pick;
  if (pick?.kind === "camera" && people.some(p => p.identity === pick.identity)) return pick;
  if (shares[0]) return { kind: "screen", identity: shares[0].identity };
  const first = people.find(p => !p.isLocal) ?? people[0];
  return first ? { kind: "camera", identity: first.identity } : null;
}

type StageProps = {
  people: Participant[]; shares: Participant[]; monitor: SpeakerMonitor;
  mode: StageMode; onMode: (mode: StageMode) => void;
  pick: StageFocus | null; onPick: (focus: StageFocus | null) => void;
  describe: (participant: Participant) => Described;
  screenLabel: (name: string) => string;
};

function IconButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" aria-label={label} aria-pressed={pressed} onClick={onClick}
    className="size-10 rounded-lg bg-black/60 text-white hover:bg-black/80 hover:text-white aria-pressed:bg-meeting" />}>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

/**
 * The big media area, the horizontal strip of everyone else under it and the plain grid alternative. Every card is bound to a
 * real LiveKit track (a camera, or a screen share kept at its own aspect ratio, never cropped).
 */
export function RoomStage({ people, shares, monitor, mode, onMode, pick, onPick, describe, screenLabel }: StageProps) {
  const t = useTranslations("meetings");
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", change); return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;
  const toggleFullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); else void stageRef.current?.requestFullscreen().catch(() => {}); };
  const stage = resolveStage(people, shares, pick);
  const byIdentity = (identity: string) => people.find(p => p.identity === identity) ?? shares.find(p => p.identity === identity);
  const feed = (participant: Participant, kind: StageFocus["kind"]) => {
    const info = describe(participant);
    return { participant, kind, info, label: kind === "screen" ? screenLabel(info.name) : info.label };
  };
  const selectFeed = (participant: Participant, kind: StageFocus["kind"]) => { onPick({ kind, identity: participant.identity }); onMode("focus"); };

  if (mode === "grid") {
    const feeds = [...shares.map(p => feed(p, "screen")), ...people.map(p => feed(p, "camera"))];
    return <div className={cn("grid min-h-0 flex-1 auto-rows-fr gap-3 overflow-y-auto overscroll-contain", feeds.length > 1 && "sm:grid-cols-2", feeds.length > 4 && "xl:grid-cols-3")} data-room-grid>
      {feeds.map(item => <ParticipantTile key={`${item.participant.identity}:${item.kind}`} participant={item.participant} monitor={monitor} source={item.kind === "screen" ? Track.Source.ScreenShare : Track.Source.Camera}
        name={item.info.name} label={item.label} photoSrc={item.info.photoSrc} guest={item.info.guest} className="aspect-video lg:aspect-auto lg:min-h-40">
        <button type="button" aria-label={t("focusOn", { name: item.label })} onClick={() => selectFeed(item.participant, item.kind)} className="absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring" />
      </ParticipantTile>)}
    </div>;
  }

  const main = stage ? byIdentity(stage.identity) : undefined;
  const mainFeed = main && stage ? feed(main, stage.kind) : null;
  // The strip lists the other feeds; the camera the stage already shows is not repeated.
  const strip = [...shares.map(p => feed(p, "screen")), ...people.map(p => feed(p, "camera"))].filter(item => !(stage && item.participant.identity === stage.identity && item.kind === stage.kind));
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div ref={stageRef} data-room-stage data-stage-kind={stage?.kind} className={cn("relative aspect-video min-h-0 lg:aspect-auto lg:flex-1", fullscreen && "bg-black")}>
      {mainFeed && <ParticipantTile key={`${mainFeed.participant.identity}:${mainFeed.kind}`} participant={mainFeed.participant} monitor={monitor} source={mainFeed.kind === "screen" ? Track.Source.ScreenShare : Track.Source.Camera}
        name={mainFeed.info.name} label={mainFeed.label} photoSrc={mainFeed.info.photoSrc} guest={mainFeed.info.guest} className="h-full w-full" />}
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        {pick && <IconButton label={t("autoFocus")} onClick={() => onPick(null)}><Presentation size={18} aria-hidden="true" /></IconButton>}
        <IconButton label={t("gridView")} onClick={() => onMode("grid")}><LayoutGrid size={18} aria-hidden="true" /></IconButton>
        {canFullscreen && <IconButton label={t(fullscreen ? "exitFullscreen" : "fullscreen")} pressed={fullscreen} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={18} aria-hidden="true" /> : <Expand size={18} aria-hidden="true" />}</IconButton>}
      </div>
    </div>
    {strip.length > 0 && <div role="list" aria-label={t("participantStrip")} data-room-strip className="flex shrink-0 snap-x gap-3 overflow-x-auto overscroll-x-contain pb-1">
      {strip.map(item => <div key={`${item.participant.identity}:${item.kind}`} role="listitem" className="h-24 shrink-0 snap-start sm:h-28">
        <ParticipantTile participant={item.participant} monitor={monitor} source={item.kind === "screen" ? Track.Source.ScreenShare : Track.Source.Camera} compact
          name={item.info.name} label={item.label} photoSrc={item.info.photoSrc} guest={item.info.guest} className="aspect-video h-full">
          <button type="button" aria-label={t("focusOn", { name: item.label })} onClick={() => selectFeed(item.participant, item.kind)} className="absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring" />
        </ParticipantTile>
      </div>)}
    </div>}
  </div>;
}
