"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DisconnectReason, LogLevel, Room, RoomEvent, Track, setLogLevel, type LocalAudioTrack } from "livekit-client";
import { ApiError } from "@/lib/api/client";
import { guestMeetingState, meetingConnectionApi, meetingsApi } from "./api";
import type { GuestMeeting, MeetingMessage, MeetingParticipant } from "./types";

// The SDK must not log signaling URLs, tokens or user/media metadata.
setLogLevel(LogLevel.silent);
/** Microphone processing the browser itself can do (never a third-party service, nothing heavy of ours): each one can be switched by the person. */
export const CAPTURE_KEYS = ["noiseSuppression", "echoCancellation", "autoGainControl"] as const;
export type CaptureKey = (typeof CAPTURE_KEYS)[number];
export type CaptureSettings = Record<CaptureKey, boolean>;
const CAPTURE_STORAGE = "pda:meeting-capture:v1";
const CAPTURE_DEFAULT: CaptureSettings = { noiseSuppression: true, echoCancellation: true, autoGainControl: true };
function loadCapture(): CaptureSettings {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CAPTURE_STORAGE) ?? "null") as Partial<CaptureSettings> | null;
    return Object.fromEntries(CAPTURE_KEYS.map(key => [key, typeof stored?.[key] === "boolean" ? stored[key] : CAPTURE_DEFAULT[key]])) as CaptureSettings;
  } catch { return CAPTURE_DEFAULT; }
}
function saveCapture(value: CaptureSettings) { try { window.localStorage.setItem(CAPTURE_STORAGE, JSON.stringify(value)); } catch { /* the choice then lasts for this call only */ } }
/** Which of them this browser can really switch; the others are shown as unsupported instead of pretending to work. */
export function captureSupport(): Record<CaptureKey, boolean> {
  const supported = typeof navigator === "undefined" ? undefined : navigator.mediaDevices?.getSupportedConstraints?.();
  return Object.fromEntries(CAPTURE_KEYS.map(key => [key, Boolean(supported?.[key])])) as Record<CaptureKey, boolean>;
}
const byTime = (a: MeetingMessage, b: MeetingMessage) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id);
/** Newer data about a message replaces the old (its reactions and quote included); the list stays oldest first. */
const merge = (previous: MeetingMessage[], incoming: MeetingMessage[]) => [...new Map([...previous, ...incoming].map(m => [m.id, m])).values()].sort(byTime);
/** What a reaction tap shows at once, before the server answers; the answer (or a reload) then replaces it. */
function withReaction(message: MeetingMessage, emoji: string, add: boolean, self: { id: string; name: string }): MeetingMessage {
  const reactions = [...(message.reactions ?? [])], index = reactions.findIndex(r => r.emoji === emoji), current = reactions[index];
  if (add) {
    if (current?.reactedByMe) return message;
    const reactor = { participantId: self.id, displayName: self.name };
    if (current) reactions[index] = { ...current, count: current.count + 1, reactedByMe: true, reactors: [...current.reactors, reactor] };
    else reactions.push({ emoji, count: 1, reactedByMe: true, reactors: [reactor] });
  } else {
    if (!current?.reactedByMe) return message;
    if (current.count <= 1) reactions.splice(index, 1);
    else reactions[index] = { ...current, count: current.count - 1, reactedByMe: false, reactors: current.reactors.filter(r => r.participantId !== self.id) };
  }
  return { ...message, reactions };
}
export type RoomPhase = "ready" | "connecting" | "connected" | "reconnecting" | "left" | "closed" | "removed" | "failed";

export function useMeetingRoom(meetingId: string, projectId?: string) {
  const api = useMemo(() => meetingConnectionApi(projectId, meetingId), [projectId, meetingId]);
  const [phase, setPhase] = useState<RoomPhase>("ready");
  const [room, setRoom] = useState<Room>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<unknown>();
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const messagesRef = useRef<MeetingMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // A member's meeting carries its organizer (the creator recorded by the server); the guest view does not.
  const [meeting, setMeeting] = useState<GuestMeeting & { organizerId?: string }>();
  const [selfId, setSelfId] = useState("");
  const [retained, setRetained] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const controls = useRef<{ join: () => void; retry: () => void; leave: () => void; older: () => Promise<void>; refreshChat: () => Promise<void>; applyCapture: (next: CaptureSettings) => Promise<void>; reloadMessage: (id: string) => Promise<void>; ensureLoaded: (id: string) => Promise<boolean> } | null>(null);
  const intended = useRef({ mic: false, camera: false });
  const devices = useRef<Partial<Record<MediaDeviceKind, string>>>({});
  // The remembered choice; it only shows once the devices panel is opened, so it never takes part in the server-rendered markup.
  const [capture, setCaptureState] = useState<CaptureSettings>(() => typeof window === "undefined" ? CAPTURE_DEFAULT : loadCapture());
  const captureRef = useRef<CaptureSettings>(capture);

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
      setMessages(previous => merge(previous, response.content));
      if (!historyPage) setHasOlder(response.totalPages > 1);
      setChatLoaded(true);
    }
    /** One message again from the server (a reaction on it changed), only when it is part of the list already. */
    async function reloadMessage(messageId: string) {
      if (!messagesRef.current.some(m => m.id === messageId)) return;
      const message = await api.message(messageId, abort.signal);
      if (alive && !stopped) setMessages(previous => merge(previous, [message]));
    }
    async function olderPage() {
      const response = await api.chat(historyPage + 1, abort.signal);
      if (!alive || stopped) return;
      historyPage++; setHasOlder(historyPage + 1 < response.totalPages); setMessages(previous => merge(previous, response.content));
    }
    /** Makes sure a message is in the list, loading older pages up to the one the server names for it; false when it is gone. */
    async function ensureLoaded(messageId: string) {
      if (messagesRef.current.some(m => m.id === messageId)) return true;
      let target: number;
      try { target = (await api.locate(messageId, abort.signal)).page; } catch { return false; }
      if (target > 40) return false; // the history reaches 1001 pages at most; further back than this is not worth loading for a quote
      while (historyPage < target && alive && !stopped) await olderPage();
      return messagesRef.current.some(m => m.id === messageId) || (await api.message(messageId, abort.signal).then(found => { setMessages(previous => merge(previous, [found])); return true; }, () => false));
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
          // Remote audio goes through a Web Audio gain node, which is what lets the per-person volume go above 100%.
          webAudioMix: true,
          audioCaptureDefaults: { deviceId: devices.current.audioinput, ...captureRef.current }, videoCaptureDefaults: { deviceId: devices.current.videoinput },
          audioOutput: { deviceId: devices.current.audiooutput }, reconnectPolicy: { nextRetryDelayInMs: () => null } });
        currentRoom = next;
        const refreshed = () => { void refreshChat().catch(() => {}); };
        for (const event of [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged, RoomEvent.AudioPlaybackStatusChanged, RoomEvent.ConnectionQualityChanged]) next.on(event, update);
        next.on(RoomEvent.TrackMuted, (publication, participant) => {
          if (participant === next.localParticipant && publication.source === Track.Source.Microphone) intended.current.mic = false;
        });
        next.on(RoomEvent.MediaDevicesError, failure => { if (alive) setError(failure); });
        next.on(RoomEvent.DataReceived, (payload, sender, _kind, topic) => {
          if (sender || topic !== "pda.meeting") return;
          // The server's envelope carries ids only: a reaction refreshes that one message, anything else refreshes the newest page.
          try {
            const envelope = JSON.parse(new TextDecoder().decode(payload)) as { type?: string; messageId?: string };
            if (envelope.type === "meeting.chat.reaction" && envelope.messageId) { void reloadMessage(envelope.messageId).catch(() => {}); return; }
          } catch { /* not JSON: fall through to the plain refresh */ }
          refreshed();
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
        if (people.some(p => p.id === currentId && p.revoked)) {
          // Ending a meeting revokes every participant. If the meeting state fetched above predates the end, this is not a
          // removal: look again, and only a meeting that is still open means this participant really was removed.
          const latest = await loadState();
          if (!latest || !alive || stopped) return;
          stop("removed"); return;
        }
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
      applyCapture: async next => {
        if (!currentRoom) return;
        currentRoom.options.audioCaptureDefaults = { ...currentRoom.options.audioCaptureDefaults, ...next };
        const track = currentRoom.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack as LocalAudioTrack | undefined;
        if (track) await track.restartTrack({ ...next, deviceId: devices.current.audioinput });
      },
      older: olderPage, reloadMessage, ensureLoaded,
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
    /** The device chosen on the ready screen; the room opens it when the person turns the microphone/camera on. */
    setPreferredDevice: (kind: "audioinput" | "videoinput", deviceId: string | undefined) => { devices.current[kind] = deviceId; },
    capture,
    /** Applies to the open microphone (it is restarted with the new constraint), to every microphone opened later and to the next calls. */
    setCapture: async (key: CaptureKey, enabled: boolean) => {
      const next = { ...captureRef.current, [key]: enabled }; captureRef.current = next; setCaptureState(next); saveCapture(next);
      await controls.current?.applyCapture(next);
    },
    switchDevice: async (kind: MediaDeviceKind, deviceId: string) => { if (room && await room.switchActiveDevice(kind, deviceId)) devices.current[kind] = deviceId; },
    join: () => controls.current?.join(), leave: () => controls.current?.leave(),
    retry: () => controls.current?.retry(),
    older: () => controls.current?.older(),
    send: async (content: string, mentionIds: string[], replyToMessageId?: string) => { await api.send(content, mentionIds, replyToMessageId); await controls.current?.refreshChat(); },
    /** Brings an answered message into the list (older pages if needed); false when it can no longer be reached. */
    ensureMessage: (messageId: string) => controls.current?.ensureLoaded(messageId) ?? Promise.resolve(false),
    /**
     * Adds or removes the caller's own emoji on a message. The list changes at once; the server's answer replaces it, and a failure
     * puts the real state back (then the error is passed on).
     */
    react: async (messageId: string, emoji: string, add: boolean) => {
      const me = participants.find(p => p.id === selfId);
      setMessages(previous => previous.map(m => m.id === messageId ? withReaction(m, emoji, add, { id: selfId, name: me?.displayName ?? "" }) : m));
      try {
        const updated = await (add ? api.react(messageId, emoji) : api.unreact(messageId, emoji));
        setMessages(previous => merge(previous, [updated]));
      } catch (failure) {
        await controls.current?.reloadMessage(messageId).catch(() => {});
        throw failure;
      }
    },
  };
}
