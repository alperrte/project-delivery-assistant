"use client";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { RemoteParticipant } from "livekit-client";
import { useMeetingRoom, type RoomPhase } from "../use-meeting-room";
import type { ChatDraft, SessionLive, SessionStore, SessionTarget } from "./meeting-session";
import { DEFAULT_VOLUME, MAX_VOLUME } from "./volume";

/**
 * The part of the call that needs the LiveKit SDK. `MeetingSessionProvider` sits in the workspace layout, so it loads
 * this file with `next/dynamic` only when a room page attaches a meeting; every other workspace route stays free of
 * the SDK (bundle budgets in bundle-budgets.json). The room page imports it directly: it needs the SDK anyway.
 */
const NO_DRAFT: ChatDraft = { content: "", mentions: [] };
const DRAFT_ENDING: RoomPhase[] = ["left", "closed", "removed"];

function RemoteAudio({ participant, volume }: { participant: RemoteParticipant; volume: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const signature = [...participant.audioTrackPublications.values()].filter(publication => publication.track).map(publication => publication.trackSid).join(":");
  useEffect(() => { participant.setVolume(volume); }, [participant, volume]);
  useEffect(() => {
    if (!signature) return;
    const elements = [...participant.audioTrackPublications.values()].flatMap(publication => {
      if (!publication.track || !ref.current) return [];
      const element = publication.track.attach(); ref.current.appendChild(element); return [{ element, track: publication.track }];
    });
    return () => elements.forEach(({ element, track }) => { track.detach(element); element.remove(); });
  }, [participant, signature]);
  return <div ref={ref} className="hidden" />;
}

/** The call itself: the LiveKit room (via `useMeetingRoom`), the remote audio elements and the shared media controls. */
export function useMeetingSessionRuntime(id: string, guest = false): { live: SessionLive; audio: ReactNode } {
  const runtime = useMeetingRoom(id, guest);
  const [mediaBusy, setMediaBusy] = useState(false), lock = useRef(false);
  // Per-person playback level in percent (0-200, 100 = as received, above 100 is a real boost through the Web Audio gain) and a separate
  // "muted for me" flag, so muting and unmuting returns to exactly the level the person had chosen. Both are local: nothing is sent.
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [stored, setStored] = useState<ChatDraft>(NO_DRAFT);
  // Leaving, ending for all or removal discard the draft; a failed connection that can be retried keeps it.
  const draft = DRAFT_ENDING.includes(runtime.phase) ? NO_DRAFT : stored;
  const setDraftContent: Dispatch<SetStateAction<string>> = value => setStored(previous => ({ ...previous, content: typeof value === "function" ? value(previous.content) : value }));
  const setDraftMentions: Dispatch<SetStateAction<string[]>> = value => setStored(previous => ({ ...previous, mentions: typeof value === "function" ? value(previous.mentions) : value }));
  const room = runtime.room;
  const clamp = (volume: number) => Math.max(0, Math.min(MAX_VOLUME, Math.round(volume)));
  const effective = (identity: string, level = volumes[identity] ?? DEFAULT_VOLUME, silenced = muted[identity] ?? false) => silenced ? 0 : level / 100;
  const setVolume = (identity: string, volume: number) => {
    const level = clamp(volume);
    // Moving the slider is an explicit choice to hear the person again.
    room?.remoteParticipants.get(identity)?.setVolume(effective(identity, level, false));
    setVolumes(previous => ({ ...previous, [identity]: level }));
    setMuted(previous => previous[identity] ? { ...previous, [identity]: false } : previous);
  };
  const setLocalMute = (identity: string, on: boolean) => {
    room?.remoteParticipants.get(identity)?.setVolume(effective(identity, undefined, on));
    setMuted(previous => ({ ...previous, [identity]: on }));
  };
  async function toggleMedia(kind: "mic" | "camera") {
    if (!room || lock.current) return undefined;
    lock.current = true; setMediaBusy(true);
    try {
      const local = room.localParticipant;
      if (kind === "mic") { const enabled = !local.isMicrophoneEnabled; await local.setMicrophoneEnabled(enabled); runtime.setIntent("mic", enabled); }
      else { const enabled = !local.isCameraEnabled; await local.setCameraEnabled(enabled); runtime.setIntent("camera", enabled); }
      return undefined;
    } catch (failure) { return failure; }
    finally { lock.current = false; setMediaBusy(false); }
  }
  const audio = room ? <div hidden>{[...room.remoteParticipants.values()].map(p => <RemoteAudio key={p.identity} participant={p} volume={effective(p.identity)} />)}</div> : null;
  return { live: { ...runtime, mediaBusy, volumes, setVolume, muted, setLocalMute, toggleMedia, draft, setDraftContent, setDraftMentions }, audio };
}

export function SessionRunner({ target, store }: { target: SessionTarget; store: SessionStore }) {
  const { live, audio } = useMeetingSessionRuntime(target.id);
  useEffect(() => { store.publish(target.key, live); });
  useEffect(() => () => store.publish(target.key, null), [store, target.key]);
  return audio;
}
