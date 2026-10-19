"use client";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { RemoteParticipant } from "livekit-client";
import { useMeetingRoom, type RoomPhase } from "../use-meeting-room";

/**
 * The meeting call outlives the meeting room page.
 *
 * LiveKit's `Room`, its tracks and the polling of participants/chat used to belong to the room page, so any in-app
 * navigation unmounted the page and hung up. They now live in a `SessionRunner` mounted by `MeetingSessionProvider`
 * high in the workspace layout; the room page and the mini bar are only views over it. The runner is mounted once
 * per join attempt and torn down only by an explicit end (leave, end for all, removal, failure), by sign-out (the
 * whole workspace unmounts) or when the room page is left before anything was joined.
 */
export type SessionTarget = { id: string; projectId: string; slug: string; roomHref: string; key: number };
type Runtime = ReturnType<typeof useMeetingRoom>;
export type SessionLive = Runtime & {
  mediaBusy: boolean;
  volumes: Record<string, number>;
  setVolume: (identity: string, volume: number) => void;
  /** Resolves with the failure (for the caller to present), or undefined on success. */
  toggleMedia: (kind: "mic" | "camera") => Promise<unknown>;
  /** The unsent chat message. It lives with the call, so it survives leaving the room page and is gone once the call has ended. */
  draft: ChatDraft;
  setDraftContent: Dispatch<SetStateAction<string>>;
  setDraftMentions: Dispatch<SetStateAction<string[]>>;
};
export type ChatDraft = { content: string; mentions: string[] };
const NO_DRAFT: ChatDraft = { content: "", mentions: [] };
const DRAFT_ENDING: RoomPhase[] = ["left", "closed", "removed"];
type Snapshot = { target: SessionTarget | null; live: SessionLive | null };

const TERMINAL: RoomPhase[] = ["left", "closed", "removed", "failed"];
export const isTerminalPhase = (phase: RoomPhase) => TERMINAL.includes(phase);
export const isInCallPhase = (phase: RoomPhase) => phase === "connecting" || phase === "connected" || phase === "reconnecting";

export function deviceErrorKey(failure: unknown): string {
  const name = failure instanceof Error ? failure.name : "";
  return name === "NotAllowedError" || name === "SecurityError" ? "permissionDenied" : name === "NotFoundError" ? "deviceMissing" : name === "NotReadableError" ? "deviceBusy" : "deviceError";
}

class SessionStore {
  private snapshot: Snapshot = { target: null, live: null };
  private readonly listeners = new Set<() => void>();
  private viewers = 0;
  private generation = 0;
  private endedElsewhere: (phase: RoomPhase) => void = () => {};

  /** The provider tells the person when a call ended while they were on another page. */
  setEndedHandler(handler: (phase: RoomPhase) => void) { this.endedElsewhere = handler; }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  getTarget = () => this.snapshot.target;

  private set(next: Snapshot) { this.snapshot = next; this.listeners.forEach(listener => listener()); }

  /**
   * A room page wants to show this meeting. "busy" means a different call is live: only one call at a time, the page
   * explains instead of replacing it. An unjoined or finished session of any meeting is simply replaced.
   */
  attach(target: Omit<SessionTarget, "key">): "ok" | "busy" {
    const { target: current, live } = this.snapshot;
    if (current && current.id !== target.id && live && isInCallPhase(live.phase)) return "busy";
    this.viewers++;
    if (current && current.id === target.id && live && !isTerminalPhase(live.phase)) return "ok";
    this.set({ target: { ...target, key: ++this.generation }, live: null });
    return "ok";
  }

  /** The room page went away. A call in progress stays; an unjoined or finished one is dropped. */
  detach() {
    this.viewers = Math.max(0, this.viewers - 1);
    if (this.viewers > 0) return;
    const { live } = this.snapshot;
    if (!live || live.phase === "ready" || isTerminalPhase(live.phase)) this.set({ target: null, live: null });
  }

  publish(key: number, live: SessionLive | null) {
    if (this.snapshot.target?.key !== key) return;
    this.set({ ...this.snapshot, live });
    if (live && isTerminalPhase(live.phase) && this.viewers === 0) {
      if (live.phase !== "left") this.endedElsewhere(live.phase);
      this.set({ target: null, live: null });
    }
  }
}

const SessionContext = createContext<SessionStore | null>(null);
const EMPTY: Snapshot = { target: null, live: null };
const emptySnapshot = () => EMPTY;
const noopSubscribe = () => () => {};

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

function SessionRunner({ target, store }: { target: SessionTarget; store: SessionStore }) {
  const { live, audio } = useMeetingSessionRuntime(target.id, target.projectId);
  useEffect(() => { store.publish(target.key, live); });
  useEffect(() => () => store.publish(target.key, null), [store, target.key]);
  return audio;
}

export function MeetingSessionProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("meetings");
  const [store] = useState(() => new SessionStore());
  const target = useSyncExternalStore(store.subscribe, store.getTarget, store.getTarget);
  useEffect(() => { store.setEndedHandler(phase => { toast.info(t(`phase.${phase}`)); }); }, [store, t]);
  return <SessionContext value={store}>{children}{target && <SessionRunner key={target.key} target={target} store={store} />}</SessionContext>;
}

/** Null outside the workspace (guest rooms own their call locally). */
export function useOptionalMeetingSession() {
  const store = useContext(SessionContext);
  const snapshot = useSyncExternalStore(store?.subscribe ?? noopSubscribe, store?.getSnapshot ?? emptySnapshot, emptySnapshot);
  return store ? { store, ...snapshot } : null;
}
