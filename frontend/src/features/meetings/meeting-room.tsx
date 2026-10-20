"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Track, type Participant } from "livekit-client";
import { Users, Video, X } from "lucide-react";
import Link from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { cn } from "@/lib/utils";
import { meetingsApi } from "./api";
import { MeetingError, useMeetingProject } from "./shared";
import { deviceErrorKey, isInCallPhase, useMeetingSessionRuntime, useOptionalMeetingSession, type SessionLive } from "./session/meeting-session";
import { ParticipantTile } from "./room/participant-tile";
import { RoomControls, type RoomPanel } from "./room/room-controls";
import { ChatPanel, DevicesPanel, ParticipantsPanel, participantPhoto } from "./room/room-panels";
import { canShareScreen, screenShareMessage } from "./room/screen-share";
import { useSpeakerMonitor } from "./room/speaker-monitor";
import { useVisualViewport } from "./room/use-visual-viewport";

function RoomClock({ openedAt, endsAt }: { openedAt: string | null; endsAt: string }) {
  const t = useTranslations("meetings");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(openedAt ?? new Date(now).toISOString())) / 1000));
  const remaining = Math.ceil((Date.parse(endsAt) - now) / 60000);
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground"><span>{t("elapsed", { time: `${String(Math.floor(elapsed / 3600)).padStart(2,"0")}:${String(Math.floor(elapsed / 60) % 60).padStart(2,"0")}:${String(elapsed % 60).padStart(2,"0")}` })}</span>{remaining > 0 ? <span>{t("remaining", { minutes: remaining })}</span> : <span role="status" className="text-warning">{t("overtime")}</span>}</div>;
}
export function ProjectMeetingRoom({ slug, id }: { slug: string; id: string }) {
  const context = useMeetingProject(slug), t = useTranslations("meetings");
  if (context.isError) return <MeetingError error={context.error} />;
  if (!context.project || !context.user) return <p role="status">{t("loading")}</p>;
  return <ProjectRoomGate key={`${context.user.id}:${context.project.id}:${id}`} slug={slug} id={id} projectId={context.project.id} userId={context.user.id} isManager={context.isManager} />;
}

/**
 * Shows this meeting's call from the workspace-level session, which keeps running when this page is left.
 * A different call that is still live blocks joining here (one call at a time) instead of being hung up.
 */
function ProjectRoomGate({ slug, id, projectId, userId, isManager }: { slug: string; id: string; projectId: string; userId: string; isManager: boolean }) {
  const t = useTranslations("meetings"), session = useOptionalMeetingSession();
  const store = session?.store, active = session?.target, activeLive = session?.live;
  const blocked = !!active && active.id !== id && !!activeLive && isInCallPhase(activeLive.phase);
  const returnHref = `/projects/${slug}/meetings/${id}`;
  useEffect(() => {
    if (!store || blocked) return;
    const result = store.attach({ id, projectId, slug, roomHref: `${returnHref}/room` });
    return () => { if (result === "ok") store.detach(); };
  }, [store, blocked, id, projectId, slug, returnHref]);
  if (!session) return <MeetingRoom id={id} projectId={projectId} userId={userId} isManager={isManager} returnHref={returnHref} />;
  if (blocked && active && activeLive) return <section role="status" className="workspace-panel max-w-2xl space-y-4 p-6">
    <h1 className="text-lg font-semibold">{t("otherMeetingTitle")}</h1>
    <p className="text-sm leading-6 text-muted-foreground">{t("otherMeetingBody", { title: activeLive.meeting?.title ?? t("group") })}</p>
    <div className="flex flex-wrap gap-2">
      <Link href={active.roomHref} className={buttonVariants({ className: "min-h-11" })}>{t("returnToActive")}</Link>
      <ConfirmDialog trigger={<Button variant="destructive" className="min-h-11">{t("leave")}</Button>} title={t("leaveTitle")} description={t("leaveDescription")} confirmLabel={t("leaveConfirm")} cancelLabel={t("leaveCancel")} destructive onConfirm={async () => { activeLive.leave(); }} />
    </div>
  </section>;
  const live = active?.id === id ? activeLive : null;
  if (!live) return <p role="status">{t("loading")}</p>;
  return <MeetingRoomView live={live} id={id} projectId={projectId} userId={userId} isManager={isManager} returnHref={returnHref} />;
}

/**
 * Participant grid on phones: every card shares the available height, so one, two or a handful of people fill the
 * screen without scrolling; beyond six the grid scrolls. Wide screens keep the fixed-ratio cards instead.
 */
function compactGrid(count: number): string {
  if (count <= 1) return "compact:grid-cols-1 compact:grid-rows-1";
  if (count === 2) return "compact:grid-cols-1 compact:grid-rows-2 compact:landscape:grid-cols-2 compact:landscape:grid-rows-1";
  if (count <= 4) return "compact:grid-cols-2 compact:grid-rows-2";
  if (count <= 6) return "compact:grid-cols-2 compact:grid-rows-3 compact:landscape:grid-cols-3 compact:landscape:grid-rows-2";
  return "compact:grid-cols-2 compact:auto-rows-[minmax(9rem,1fr)] compact:landscape:grid-cols-3 compact:landscape:auto-rows-[minmax(8rem,1fr)] compact:overflow-y-auto";
}

/** A call owned by this page alone: guest rooms (outside the workspace) and the fallback without a session provider. */
export function MeetingRoom({ id, projectId, userId, isManager = false, returnHref }: { id: string; projectId?: string; userId?: string; isManager?: boolean; returnHref?: string }) {
  const { live, audio } = useMeetingSessionRuntime(id, projectId);
  return <><MeetingRoomView live={live} id={id} projectId={projectId} userId={userId} isManager={isManager} returnHref={returnHref} />{audio}</>;
}

function MeetingRoomView({ live, id, projectId, userId, isManager = false, returnHref }: { live: SessionLive; id: string; projectId?: string; userId?: string; isManager?: boolean; returnHref?: string }) {
  const t = useTranslations("meetings");
  const [panel, setPanel] = useState<RoomPanel | null>(null);
  // The text box is driven by local state so typing never waits on the call session (a value that arrives a render late
  // would overwrite keystrokes); every change is written through to the session, which keeps it while this page is away.
  const [content, setLocalContent] = useState(live.draft.content), [mentions, setLocalMentions] = useState(live.draft.mentions);
  const contentNow = useRef(content), mentionsNow = useRef(mentions);
  const setContent: Dispatch<SetStateAction<string>> = value => {
    const next = typeof value === "function" ? value(contentNow.current) : value;
    contentNow.current = next; setLocalContent(next); live.setDraftContent(next);
  };
  const setMentions: Dispatch<SetStateAction<string[]>> = value => {
    const next = typeof value === "function" ? value(mentionsNow.current) : value;
    mentionsNow.current = next; setLocalMentions(next); live.setDraftMentions(next);
  };
  const [sending, setSending] = useState(false), mediaBusy = live.mediaBusy;
  const [screenBusy, setScreenBusy] = useState(false), screenLock = useRef(false);
  const [endOpen, setEndOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceError, setDeviceError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const preview = useRef<HTMLVideoElement>(null), previewTracks = useRef<MediaStream | undefined>(undefined);
  const previewGeneration = useRef(0);
  const active = live.phase === "connected", room = live.room;
  const inCall = !["ready", "left", "closed", "removed", "failed"].includes(live.phase);
  const people: Participant[] = room ? [room.localParticipant, ...room.remoteParticipants.values()] : [];
  const shares = people.filter(p => p.isScreenShareEnabled);
  const sharing = shares.length > 0, sharingSelf = Boolean(room?.localParticipant.isScreenShareEnabled);
  const monitor = useSpeakerMonitor(room);
  const viewport = useVisualViewport(inCall);
  const lookup = new Map(live.participants.map(p => [p.identity, p]));
  // Moderation (mute, remove) stays with project managers; ending the meeting for everyone is only for its creator, whatever their role.
  const managerProjectId = isManager ? projectId : undefined;
  const endProjectId = userId && live.meeting?.organizerId === userId ? projectId : undefined;
  const nameOf = (p: Participant) => lookup.get(p.identity)?.displayName ?? p.name ?? p.identity;

  // Unread badge: whatever existed when the first chat load finished (and everything while the chat is open) counts as read.
  const latestMessage = live.messages.at(-1)?.sentAt ?? "";
  if (live.chatLoaded && (seenAt === null || panel === "chat") && seenAt !== latestMessage) setSeenAt(latestMessage);
  const unread = seenAt === null ? 0 : live.messages.filter(m => m.participantId !== live.selfId && m.sentAt > seenAt).length;

  useEffect(() => {
    if (panel !== "devices" || !navigator.mediaDevices) return;
    let alive = true;
    const refresh = () => { void navigator.mediaDevices.enumerateDevices().then(value => { if (alive) setDevices(value); }).catch(() => {}); };
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => { alive = false; navigator.mediaDevices.removeEventListener("devicechange", refresh); };
  }, [panel]);
  function stopPreview() { previewGeneration.current++; previewTracks.current?.getTracks().forEach(track => track.stop()); previewTracks.current = undefined; if (preview.current) preview.current.srcObject = null; }
  useEffect(() => { const tracks = previewTracks, generation = previewGeneration; return () => { generation.current++; tracks.current?.getTracks().forEach(track => track.stop()); }; }, []);
  async function startPreview(microphone = false) {
    stopPreview(); const generation = previewGeneration.current;
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: !microphone, audio: microphone }); if (generation !== previewGeneration.current) { stream.getTracks().forEach(track => track.stop()); return; } previewTracks.current = stream; if (preview.current) preview.current.srcObject = stream; setDeviceError(undefined); setNotice(microphone ? t("microphoneReady") : undefined); }
    catch (failure) { showDeviceError(failure); }
  }
  function showDeviceError(failure: unknown) { setDeviceError(deviceErrorKey(failure)); }
  async function media(kind: "mic" | "camera") {
    if (!room) return;
    setDeviceError(undefined);
    const failure = await live.toggleMedia(kind);
    if (failure) showDeviceError(failure);
  }
  /**
   * The browser call runs straight from the tap (no awaits before it), because getDisplayMedia needs a user gesture.
   * Where the browser has no such API (every phone browser today) the tap explains that instead of doing nothing.
   * Stopping, including the browser's own "stop sharing" control, ends in LocalTrackUnpublished, which refreshes this view.
   */
  async function toggleScreen() {
    if (!room || screenLock.current) return;
    const local = room.localParticipant, enable = !local.isScreenShareEnabled;
    if (enable && !canShareScreen()) { toast.info(t("screenShareUnsupported"), { duration: 8000 }); return; }
    screenLock.current = true; setScreenBusy(true);
    try { await local.setScreenShareEnabled(enable, { audio: true }); }
    catch (failure) {
      const message = screenShareMessage(failure);
      (message === "screenShareCancelled" || message === "screenShareUnsupported" ? toast.info : toast.error)(t(message), { duration: message === "screenShareUnsupported" ? 8000 : undefined });
    } finally { screenLock.current = false; setScreenBusy(false); }
  }
  async function togglePanel(next: RoomPanel) {
    setPanel(previous => previous === next ? null : next);
    if (next === "devices" && panel !== "devices") {
      try { setDevices(await navigator.mediaDevices.enumerateDevices()); } catch (failure) { showDeviceError(failure); }
    }
  }
  async function send() {
    if (!content.trim() || sending) return; setSending(true);
    try { await live.send(content.trim(), mentions); setContent(""); setMentions([]); live.setError(undefined); }
    catch (failure) { live.setError(failure); } finally { setSending(false); }
  }
  const tiles = people.map((p, index) => <ParticipantTile key={p.identity} participant={p} monitor={monitor}
    name={nameOf(p)} label={`${lookup.get(p.identity)?.displayName ?? p.name ?? t("member")}${p === room?.localParticipant ? ` (${t("you")})` : ""}`}
    photoSrc={participantPhoto(lookup.get(p.identity))} guest={lookup.get(p.identity)?.guest}
    className={cn("aspect-video compact:aspect-auto",
      sharing && "compact:aspect-video compact:h-full compact:shrink-0 compact:landscape:h-auto compact:landscape:w-full",
      !sharing && people.length > 1 && people.length <= 6 && people.length % 2 === 1 && index === people.length - 1 && "compact:portrait:col-span-2")} />);

  return <div data-meeting-room
    style={inCall ? { "--room-top": "calc(3.5rem + env(safe-area-inset-top))", "--room-bar": viewport.keyboard ? "0px" : "calc(3.75rem + env(safe-area-inset-bottom))", ...(viewport.height ? { "--vvh": `${viewport.height}px`, "--vvt": `${viewport.top}px` } : {}) } as React.CSSProperties : undefined}
    className={inCall ? "flex min-w-0 flex-col gap-4 compact:fixed compact:inset-x-0 compact:top-[var(--vvt,0px)] compact:z-40 compact:h-[var(--vvh,100dvh)] compact:gap-0 compact:overflow-hidden compact:bg-background" : "min-w-0 space-y-4"}>
    <header className={cn("flex flex-wrap items-center justify-between gap-3", inCall && "compact:h-[var(--room-top)] compact:shrink-0 compact:flex-nowrap compact:items-center compact:gap-2 compact:overflow-hidden compact:border-b compact:px-3 compact:pb-2 compact:pt-[max(0.5rem,env(safe-area-inset-top))]")}>
      <div className="min-w-0"><h1 className="break-words text-xl font-semibold compact:truncate compact:text-base">{live.meeting?.title ?? t("group")}</h1>{live.meeting && <RoomClock openedAt={live.meeting.openedAt} endsAt={live.meeting.endsAt} />}</div>
      <div className="flex shrink-0 items-center gap-2">
        <p role="status" className={`text-sm compact:text-xs ${active ? "text-success" : "text-muted-foreground"}`}>{t(`phase.${live.phase}`)}</p>
        {inCall && <Button variant={panel === "participants" ? "secondary" : "ghost"} className="hidden min-h-11 min-w-11 gap-1.5 compact:inline-flex" aria-label={t("participants")} aria-pressed={panel === "participants"} disabled={!active} onClick={() => void togglePanel("participants")}><Users size={18} aria-hidden="true" /><span className="tabular-nums">{people.length}</span></Button>}
      </div>
    </header>
    <div className={cn("space-y-2 empty:hidden", inCall && "compact:px-3 compact:pt-2")}>
      {live.error != null && <MeetingError error={live.error} />}{deviceError && <p role="alert" className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">{t(deviceError)}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
      {sharingSelf && <p role="status" className="rounded-lg border border-live/30 bg-live/10 px-3 py-2 text-sm">{t("screenSharing")}</p>}
      {room && !room.canPlaybackAudio && <Button variant="outline" className="min-h-11" onClick={() => void room.startAudio().catch(showDeviceError)}>{t("enableAudio")}</Button>}
    </div>
    {live.phase === "ready" ? <div className="workspace-panel mx-auto grid max-w-3xl gap-6 p-4 sm:p-6 md:grid-cols-2"><div><div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-surface-2"><video ref={preview} autoPlay muted playsInline className="h-full w-full object-contain" /></div><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => void startPreview()}>{t("previewCamera")}</Button><Button variant="outline" className="min-h-11" onClick={() => void startPreview(true)}>{t("testMicrophone")}</Button><Button variant="ghost" className="min-h-11" onClick={stopPreview}>{t("stopPreview")}</Button></div></div><div className="flex flex-col items-start gap-4"><Video size={28} className="text-primary" /><h2 className="text-lg font-semibold">{t("readyTitle")}</h2><p className="text-sm leading-6 text-muted-foreground">{t("joinPrivacy")}</p><Button className="min-h-11" onClick={() => { stopPreview(); live.join(); }}>{t("join")}</Button></div></div>
    : !inCall ? <section className="workspace-panel space-y-4 p-8"><h2 className="font-semibold">{t(`phase.${live.phase}`)}</h2>{live.phase === "failed" && <Button onClick={live.retry}>{t("retry")}</Button>}{returnHref && <Link href={returnHref} className="inline-flex min-h-11 items-center underline">{t("back")}</Link>}</section>
    : <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row compact:flex-col compact:gap-0">
        <section aria-label={t("videoGrid")} className="min-w-0 flex-1 space-y-4 compact:flex compact:min-h-0 compact:flex-col compact:space-y-0 compact:p-2">
          <div className="min-w-0 space-y-4 compact:flex compact:min-h-0 compact:flex-1 compact:flex-col compact:gap-2 compact:space-y-0 compact:landscape:flex-row">
            {sharing && <div className="space-y-4 compact:flex compact:min-h-0 compact:min-w-0 compact:flex-[3] compact:flex-col compact:gap-2 compact:space-y-0">
              {shares.map(p => <ParticipantTile key={`${p.identity}:screen`} participant={p} monitor={monitor} source={Track.Source.ScreenShare} name={nameOf(p)} label={t("sharedScreenOf", { name: nameOf(p) })} className="aspect-video compact:aspect-auto compact:min-h-0 compact:flex-1" />)}
            </div>}
            {people.length > 0 && <div className={cn("grid min-w-0 gap-3 sm:grid-cols-2",
              sharing ? "compact:flex compact:shrink-0 compact:gap-2 compact:overflow-x-auto compact:overscroll-contain compact:h-24 compact:landscape:h-auto compact:landscape:w-32 compact:landscape:flex-col compact:landscape:overflow-x-hidden compact:landscape:overflow-y-auto"
                : cn("compact:min-h-0 compact:flex-1 compact:gap-2", compactGrid(people.length)))}>{tiles}</div>}
          </div>
          {!people.length && <div className="workspace-panel grid min-h-60 place-items-center p-6 text-sm text-muted-foreground">{t(`phase.${live.phase}`)}</div>}
        </section>
        {panel && <aside aria-label={t(panel)} onKeyDown={event => { if (event.key === "Escape") setPanel(null); }}
          className="workspace-panel flex max-h-[70dvh] min-w-0 flex-col overflow-hidden p-4 lg:sticky lg:top-24 lg:w-80 lg:shrink-0 compact:fixed compact:inset-x-0 compact:top-[calc(var(--vvt,0px)+var(--room-top))] compact:z-30 compact:h-[calc(var(--vvh,100dvh)-var(--room-top)-var(--room-bar))] compact:max-h-none compact:rounded-none compact:border-0 compact:px-3 compact:pb-3 compact:pt-3">
          <div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-semibold">{t(panel)}</h2><Button variant="ghost" className="min-h-11 min-w-11" aria-label={t("closePanel")} onClick={() => setPanel(null)}><X size={18} aria-hidden="true" /></Button></div>
          {panel === "participants" && <ParticipantsPanel live={live} volumes={live.volumes} onVolume={live.setVolume} managerProjectId={managerProjectId} meetingId={id} onNotice={setNotice} />}
          {panel === "chat" && <ChatPanel live={live} active={active} content={content} setContent={setContent} mentions={mentions} setMentions={setMentions} sending={sending} onSend={() => void send()} />}
          {panel === "devices" && <DevicesPanel room={room} devices={devices} onSwitch={(kind, deviceId) => void live.switchDevice(kind, deviceId).catch(showDeviceError)} />}
        </aside>}
      </div>
      <RoomControls active={active} mediaBusy={mediaBusy} mic={Boolean(room?.localParticipant.isMicrophoneEnabled)} camera={Boolean(room?.localParticipant.isCameraEnabled)}
        sharing={sharingSelf} screenBusy={screenBusy} screenSupported={canShareScreen()} panel={panel} unread={unread} keyboard={viewport.keyboard}
        canEndForAll={Boolean(endProjectId)}
        onMic={() => void media("mic")} onCamera={() => void media("camera")} onScreen={() => void toggleScreen()} onPanel={next => void togglePanel(next)}
        onEndForAll={() => setEndOpen(true)} onLeave={async () => { stopPreview(); live.leave(); }} />
      {endProjectId && <ConfirmDialog open={endOpen} onOpenChange={setEndOpen} title={t("endForAll")} description={t("endConfirm")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} destructive
        onConfirm={async () => { await meetingsApi.action(endProjectId, id, "end"); live.leave(); }} />}
    </>}
  </div>;
}
