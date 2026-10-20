"use client";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { RemoteParticipant } from "livekit-client";
import { useMeetingRoom, type RoomPhase } from "../use-meeting-room";
import type { ChatDraft, SessionLive, SessionStore, SessionTarget } from "./meeting-session";

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
export function useMeetingSessionRuntime(id: string, projectId?: string): { live: SessionLive; audio: ReactNode } {
  const runtime = useMeetingRoom(id, projectId);
  const [mediaBusy, setMediaBusy] = useState(false), lock = useRef(false);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [stored, setStored] = useState<ChatDraft>(NO_DRAFT);
  // Leaving, ending for all or removal discard the draft; a failed connection that can be retried keeps it.
  const draft = DRAFT_ENDING.includes(runtime.phase) ? NO_DRAFT : stored;
  const setDraftContent: Dispatch<SetStateAction<string>> = value => setStored(previous => ({ ...previous, content: typeof value === "function" ? value(previous.content) : value }));
  const setDraftMentions: Dispatch<SetStateAction<string[]>> = value => setStored(previous => ({ ...previous, mentions: typeof value === "function" ? value(previous.mentions) : value }));
  const room = runtime.room;
  const setVolume = (identity: string, volume: number) => {
    room?.remoteParticipants.get(identity)?.setVolume(volume / 100);
    setVolumes(previous => ({ ...previous, [identity]: volume }));
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
  const audio = room ? <div hidden>{[...room.remoteParticipants.values()].map(p => <RemoteAudio key={p.identity} participant={p} volume={(volumes[p.identity] ?? 100) / 100} />)}</div> : null;
  return { live: { ...runtime, mediaBusy, volumes, setVolume, toggleMedia, draft, setDraftContent, setDraftMentions }, audio };
}

export function SessionRunner({ target, store }: { target: SessionTarget; store: SessionStore }) {
  const { live, audio } = useMeetingSessionRuntime(target.id, target.projectId);
  useEffect(() => { store.publish(target.key, live); });
  useEffect(() => () => store.publish(target.key, null), [store, target.key]);
  return audio;
}
