"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DisconnectReason, LogLevel, Room, RoomEvent, Track, setLogLevel } from "livekit-client";
import { ApiError } from "@/lib/api/client";
import { guestMeetingState, meetingConnectionApi, meetingsApi } from "./api";
import type { GuestMeeting, MeetingMessage, MeetingParticipant } from "./types";

// The SDK must not log signaling URLs, tokens or user/media metadata.
setLogLevel(LogLevel.silent);
export type RoomPhase = "ready" | "connecting" | "connected" | "reconnecting" | "left" | "closed" | "removed" | "failed";

export function useMeetingRoom(meetingId: string, projectId?: string) {
  const api = useMemo(() => meetingConnectionApi(projectId, meetingId), [projectId, meetingId]);
  const [phase, setPhase] = useState<RoomPhase>("ready");
  const [room, setRoom] = useState<Room>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<unknown>();
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [meeting, setMeeting] = useState<GuestMeeting>();
  const [selfId, setSelfId] = useState("");
  const [retained, setRetained] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const controls = useRef<{ join: () => void; retry: () => void; leave: () => void; older: () => Promise<void>; refreshChat: () => Promise<void> } | null>(null);
  const intended = useRef({ mic: false, camera: false });
  const devices = useRef<Partial<Record<MediaDeviceKind, string>>>({});

  useEffect(() => {
    let alive = true, stopped = false, suspended = false, joining = false, joined = false, attempts = 0, epoch = -1, currentId = "", currentRoom: Room | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined, historyPage = 0, polling = false;
    const abort = new AbortController();
    const update = () => { if (alive) setRevision(n => n + 1); };
    function dispose() {
      if (!currentRoom) return;
      const previous = currentRoom; currentRoom = undefined;
      previous.removeAllListeners();
      previous.localParticipant.trackPublications.forEach(publication => { publication.track?.stop(); publication.track?.detach(); });
      previous.remoteParticipants.forEach(participant => participant.trackPublications.forEach(publication => publication.track?.detach()));
      void previous.disconnect(true).catch(() => {});
      if (alive) setRoom(undefined);
    }
    function stop(next: RoomPhase, failure?: unknown) {
      stopped = true; suspended = false; clearTimeout(retryTimer); dispose();
      if (alive) { setPhase(next); setError(failure); }
    }
    async function refreshChat() {
      const response = await api.chat(0, abort.signal);
      if (!alive || stopped) return;
      setMessages(previous => {
        const merged = new Map(previous.map(m => [m.id, m]));
        response.content.forEach(m => merged.set(m.id, m));
        return [...merged.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id));
      });
      if (!historyPage) setHasOlder(response.totalPages > 1);
      setChatLoaded(true);
    }
    async function loadState() {
      const state = projectId ? await meetingsApi.detail(projectId, meetingId, abort.signal) : await guestMeetingState(meetingId, abort.signal);
      if (!alive || stopped) return undefined;
      setMeeting(state);
      if (state.status !== "OPEN") { stop("closed"); return undefined; }
      return state;
    }
    function schedule(failure?: unknown) {
      if (!alive || stopped || retryTimer) return;
      if (failure instanceof ApiError && [401, 403, 404, 409].includes(failure.status)) {
        stop(failure.status === 403 ? "removed" : "closed", failure); return;
      }
      if (++attempts > 6) { stop("failed", failure); return; }
      dispose(); setPhase("reconnecting"); if (failure) setError(failure);
      const seconds = failure instanceof ApiError ? failure.retryAfter ?? 0 : 0;
      retryTimer = setTimeout(() => { retryTimer = undefined; void connect(); }, Math.max(2500, Math.min(30000, 2000 * 2 ** (attempts - 1)), seconds * 1000));
    }
    async function restoreOwnMedia(next: Room) {
      // Restoring a previously chosen publication must never open a new permission prompt.
      for (const kind of ["microphone", "camera"] as const) {
        if (!(kind === "microphone" ? intended.current.mic : intended.current.camera)) continue;
        try {
          const permission = await navigator.permissions.query({ name: kind as PermissionName });
          if (permission.state !== "granted" || !alive || stopped || currentRoom !== next) continue;
          if (kind === "microphone") await next.localParticipant.setMicrophoneEnabled(true);
          else await next.localParticipant.setCameraEnabled(true);
        } catch { /* Unsupported permission query: user can restore explicitly from the toolbar. */ }
      }
    }
    async function connect() {
      if (!alive || stopped || joining) return;
      joining = true;
      try {
        const state = await loadState();
        if (!state || !alive || stopped) return;
        if (state.reconnectRequired) throw new ApiError(503, "MEETING_RECONNECT_PENDING", undefined, undefined, 10);
        const admission = await api.join(abort.signal);
        if (!alive || stopped) return;
        joined = true; currentId = admission.participantId; setSelfId(currentId); setRetained(admission.chatRetained); epoch = admission.roomEpoch;
        dispose();
        const next = new Room({ adaptiveStream: true, dynacast: true,
          audioCaptureDefaults: { deviceId: devices.current.audioinput }, videoCaptureDefaults: { deviceId: devices.current.videoinput },
          audioOutput: { deviceId: devices.current.audiooutput }, reconnectPolicy: { nextRetryDelayInMs: () => null } });
        currentRoom = next;
        const refreshed = () => { void refreshChat().catch(() => {}); };
        for (const event of [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged, RoomEvent.AudioPlaybackStatusChanged, RoomEvent.ConnectionQualityChanged]) next.on(event, update);
        next.on(RoomEvent.TrackMuted, (publication, participant) => {
          if (participant === next.localParticipant && publication.source === Track.Source.Microphone) intended.current.mic = false;
        });
        next.on(RoomEvent.MediaDevicesError, failure => { if (alive) setError(failure); });
        next.on(RoomEvent.DataReceived, (_payload, sender, _kind, topic) => {
          if (!sender && topic === "pda.meeting") refreshed();
        });
        next.on(RoomEvent.Disconnected, reason => {
          // Room deletion during moderation also disconnects innocent participants. Re-authorize via REST.
          if (reason === DisconnectReason.CLIENT_INITIATED) return;
          if (reason === DisconnectReason.DUPLICATE_IDENTITY) { stop("failed", new ApiError(409, "MEETING_DUPLICATE_TAB")); return; }
          schedule();
        });
        await next.connect(admission.media.url, admission.media.token);
        if (!alive || stopped || currentRoom !== next) { next.removeAllListeners(); await next.disconnect(true); return; }
        setRoom(next); setPhase("connected"); setError(undefined); attempts = 0;
        await restoreOwnMedia(next); update(); refreshed();
      } catch (failure) { if (alive && !stopped) schedule(failure); }
      finally { joining = false; }
      // Names and profile photos arrive with the participant list; fetch it now instead of at the next 4 s tick.
      if (currentRoom && joined && !stopped) void poll();
    }
    async function poll() {
      if (polling || !joined || stopped || joining) return;
      polling = true;
      try {
        const state = await loadState();
        if (!state || !alive || stopped) return;
        const people = await api.participants(abort.signal);
        if (!alive || stopped) return;
        setParticipants(people);
        if (people.some(p => p.id === currentId && p.revoked)) { stop("removed"); return; }
        if (state.reconnectRequired || state.roomEpoch !== epoch) { schedule(); return; }
        if (currentRoom) await refreshChat().catch(() => {});
      } catch (failure) {
        if (failure instanceof ApiError && [401, 403, 404, 409].includes(failure.status)) stop(failure.status === 403 ? "removed" : "closed", failure);
      } finally { polling = false; }
    }
    controls.current = {
      retry: () => { if (!alive || joining) return; stopped = false; attempts = 0; setError(undefined); setPhase("connecting"); void connect(); },
      join: () => { if (!joined) { setPhase("connecting"); void connect(); } },
      // A second call (double tap, or a confirmation that fires twice) must not send another leave request.
      leave: () => { if (stopped) return; const wasJoined = joined; stop("left"); if (wasJoined) void api.leave().catch(() => {}); },
      refreshChat,
      older: async () => { const response = await api.chat(historyPage + 1, abort.signal); if (!alive || stopped) return; historyPage++; setHasOlder(historyPage + 1 < response.totalPages); setMessages(previous => [...new Map([...response.content, ...previous].map(m => [m.id, m])).values()].sort((a,b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id))); },
    };
    const timer = setInterval(() => void poll(), 4000);
    void loadState().catch(failure => { if (alive) setError(failure); });
    // Browser reload/navigation is a transport disconnect, not an explicit guest-session revocation.
    // An unmount's late leave request could also remove a replacement connection with the same identity.
    const unload = () => { if (stopped) return; suspended = true; stopped = true; clearTimeout(retryTimer); retryTimer = undefined; dispose(); };
    const resume = (event: PageTransitionEvent) => { if (event.persisted && suspended && joined) { suspended = false; stopped = false; attempts = 0; setPhase("reconnecting"); void connect(); } };
    window.addEventListener("pagehide", unload);
    window.addEventListener("pageshow", resume);
    return () => { alive = false; stopped = true; abort.abort(); clearInterval(timer); clearTimeout(retryTimer); window.removeEventListener("pagehide", unload); window.removeEventListener("pageshow", resume); dispose(); controls.current = null; };
  }, [api, meetingId, projectId]);

  return { phase, room, revision, participants, messages, meeting, selfId, retained, error, setError, hasOlder, chatLoaded,
    setIntent: (kind: "mic" | "camera", enabled: boolean) => { intended.current[kind] = enabled; },
    switchDevice: async (kind: MediaDeviceKind, deviceId: string) => { if (room && await room.switchActiveDevice(kind, deviceId)) devices.current[kind] = deviceId; },
    join: () => controls.current?.join(), leave: () => controls.current?.leave(),
    retry: () => controls.current?.retry(),
    older: () => controls.current?.older(),
    send: async (content: string, mentionIds: string[]) => { await api.send(content, mentionIds); await controls.current?.refreshChat(); },
  };
}
