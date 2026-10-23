"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Track, type Participant } from "livekit-client";
import { ChevronLeft, Clock, Link2, PhoneOff, Users, X } from "lucide-react";
import Link from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { meetingsApi } from "./api";
import { clockText, MeetingError, useMeetingProject, useNow } from "./shared";
import { deviceErrorKey, isInCallPhase, useOptionalMeetingSession, type SessionLive } from "./session/meeting-session";
import { useMeetingSessionRuntime } from "./session/meeting-session-runtime";
import { PreJoinCheck } from "./room/device-check";
import { ParticipantTile } from "./room/participant-tile";
import { RoomStage, type StageFocus, type StageMode } from "./room/room-stage";
import { ParticipantMenu, ParticipantMenuProvider, type ParticipantMenuApi } from "./room/participant-menu";
import { COMPACT_QUERY, WIDE_QUERY, useFitViewport, useMediaQuery } from "./room/use-media-query";
import { RoomControls, type RoomPanel } from "./room/room-controls";
import { ChatPanel, DevicesPanel, ParticipantsPanel, participantPhoto } from "./room/room-panels";
import { canShareScreen, screenShareMessage } from "./room/screen-share";
import { useSpeakerMonitor } from "./room/speaker-monitor";
import { useVisualViewport } from "./room/use-visual-viewport";

function RoomClock({ openedAt, endsAt }: { openedAt: string | null; endsAt: string }) {
  const t = useTranslations("meetings"), locale = useLocale();
  const now = useNow(1000);
  const elapsed = Math.max(0, Math.floor((now - Date.parse(openedAt ?? new Date(now).toISOString())) / 1000));
  const remaining = Math.ceil((Date.parse(endsAt) - now) / 60000);
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
    <span className="inline-flex items-center gap-1"><Clock size={13} aria-hidden="true" />{t("elapsed", { time: clockText(elapsed) })}</span>
    <span>{t("plannedEnd", { time: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(endsAt)) })}{remaining > 0 && ` · ${t("remainingShort", { minutes: remaining })}`}</span>
    {remaining <= 0 && <span role="status" className="text-warning">{t("overtime")}</span>}
  </div>;
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
  const t = useTranslations("meetings"), locale = useLocale();
  const compact = useMediaQuery(COMPACT_QUERY), root = useRef<HTMLDivElement>(null);
  // The side panel is open from the start where there is room for it (a wide window), like the reference; phones start with the stage alone.
  const [panel, setPanel] = useState<RoomPanel | null>(() => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches ? "participants" : null);
  const [mode, setMode] = useState<StageMode>("focus"), [pick, setPick] = useState<StageFocus | null>(null);
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
  const active = live.phase === "connected", room = live.room;
  const inCall = !["ready", "left", "closed", "removed", "failed"].includes(live.phase);
  const people: Participant[] = room ? [room.localParticipant, ...room.remoteParticipants.values()] : [];
  const shares = people.filter(p => p.isScreenShareEnabled);
  const sharing = shares.length > 0, sharingSelf = Boolean(room?.localParticipant.isScreenShareEnabled);
  const monitor = useSpeakerMonitor(room);
  const viewport = useVisualViewport(inCall);
  useFitViewport(root, inCall);
  // "Start now" lands here with ?autojoin=1: join once, with the microphone and camera still off (nothing is switched on without a tap).
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current || live.phase !== "ready") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("autojoin") !== "1") return;
    autoJoined.current = true; url.searchParams.delete("autojoin");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    live.join();
  }, [live]);
  const lookup = new Map(live.participants.map(p => [p.identity, p]));
  // Moderation (mute, remove) stays with project managers; ending the meeting for everyone is only for its creator, whatever their role.
  const managerProjectId = isManager ? projectId : undefined;
  const endProjectId = userId && live.meeting?.organizerId === userId ? projectId : undefined;
  // Guest invites follow the detail page's rule: the organizer or a project manager.
  const inviteProjectId = projectId && (isManager || endProjectId) ? projectId : undefined;
  const nameOf = (p: Participant) => lookup.get(p.identity)?.displayName ?? p.name ?? p.identity;
  const describe = (p: Participant) => ({
    name: nameOf(p), label: `${lookup.get(p.identity)?.displayName ?? p.name ?? t("member")}${p === room?.localParticipant ? ` (${t("you")})` : ""}`,
    photoSrc: participantPhoto(lookup.get(p.identity)), guest: Boolean(lookup.get(p.identity)?.guest),
  });

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
      // The SDK also reports the failure as a room-level device error; it is explained right here, so the generic banner is cleared.
      live.setError(undefined);
      // Stopping is idempotent: a share that already ended (the browser's own "Stop sharing", a closed window) is not an error.
      if (!enable) return;
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
  async function copyLink() {
    if (!returnHref) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}${localizeHref(returnHref, locale as Locale)}`); toast.success(t("linkCopied")); }
    catch { toast.error(t("linkCopyFailed")); }
  }
  // The lock is a ref: two Enter presses in the same tick must not both pass a `sending` state that has not re-rendered yet.
  const sendLock = useRef(false);
  async function send() {
    if (!content.trim() || sendLock.current) return;
    sendLock.current = true; setSending(true);
    try { await live.send(content.trim(), mentions); setContent(""); setMentions([]); live.setError(undefined); }
    catch (failure) { live.setError(failure); } finally { sendLock.current = false; setSending(false); }
  }
  // Phones keep the equal-share grid; every other size gets the stage with the strip (or the plain grid when chosen).
  const tiles = people.map((p, index) => <ParticipantMenu key={p.identity} target={{ identity: p.identity, name: nameOf(p), self: p === room?.localParticipant, photoSrc: participantPhoto(lookup.get(p.identity)), guest: lookup.get(p.identity)?.guest }}
    className="absolute top-1 right-1 z-10 size-9 rounded-lg bg-black/60 text-white hover:bg-black/80 hover:text-white">
    {menu => <ParticipantTile participant={p} monitor={monitor}
      name={nameOf(p)} label={describe(p).label}
      photoSrc={participantPhoto(lookup.get(p.identity))} guest={lookup.get(p.identity)?.guest}
      className={cn("aspect-video compact:aspect-auto",
        sharing && "compact:aspect-video compact:h-full compact:shrink-0 compact:landscape:h-auto compact:landscape:w-full",
        !sharing && people.length > 1 && people.length <= 6 && people.length % 2 === 1 && index === people.length - 1 && "compact:portrait:col-span-2")}>{menu}</ParticipantTile>}
  </ParticipantMenu>);
  // One menu source for every card and row of the room: local volume and mute, focus and (managers only) the two moderation actions.
  const menuApi: ParticipantMenuApi = {
    volumes: live.volumes, muted: live.muted, setVolume: live.setVolume, setLocalMute: live.setLocalMute,
    managerProjectId, meetingId: id, participantId: identity => lookup.get(identity)?.id, onNotice: setNotice, onFailure: live.setError,
    focusedIdentity: pick?.kind === "camera" ? pick.identity : null,
    onFocus: compact ? undefined : identity => { if (identity) { setPick({ kind: "camera", identity }); setMode("focus"); } else setPick(null); },
  };
  const tabs = panel === "participants" || panel === "chat";

  return <ParticipantMenuProvider value={menuApi}><div data-meeting-room ref={root}
    style={inCall ? { "--room-top": "calc(3.5rem + env(safe-area-inset-top))", "--room-bar": viewport.keyboard ? "0px" : "calc(3.75rem + env(safe-area-inset-bottom))", ...(viewport.height ? { "--vvh": `${viewport.height}px`, "--vvt": `${viewport.top}px` } : {}) } as React.CSSProperties : undefined}
    className={inCall ? "flex min-w-0 flex-col gap-3 compact:fixed compact:inset-x-0 compact:top-[var(--vvt,0px)] compact:z-40 compact:h-[var(--vvh,100dvh)] compact:gap-0 compact:overflow-hidden compact:bg-background" : "min-w-0 space-y-4"}>
    <header className={cn("flex flex-wrap items-center justify-between gap-3", inCall && "compact:h-[var(--room-top)] compact:shrink-0 compact:flex-nowrap compact:items-center compact:gap-2 compact:overflow-hidden compact:border-b compact:px-3 compact:pb-2 compact:pt-[max(0.5rem,env(safe-area-inset-top))]")}>
      <div className="flex min-w-0 items-center gap-3">
        {inCall && returnHref && <Tooltip><TooltipTrigger render={<Link href={returnHref} aria-label={t("minimize")} className={buttonVariants({ variant: "outline", className: "size-10 shrink-0 compact:size-9" })} />}><ChevronLeft size={18} aria-hidden="true" /></TooltipTrigger><TooltipContent>{t("minimize")}</TooltipContent></Tooltip>}
        <div className="min-w-0 space-y-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="break-words text-xl font-semibold compact:truncate compact:text-base">{live.meeting?.title ?? t("group")}</h1>
            <p role="status" className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium compact:hidden", active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}><span aria-hidden="true" className={cn("size-1.5 rounded-full bg-current", live.phase === "reconnecting" && "animate-pulse")} />{t(`phase.${live.phase}`)}</p>
            {inCall && <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground compact:hidden"><Users size={13} aria-hidden="true" />{t("participantCount", { count: people.length })}</span>}
          </div>
          {live.meeting && <RoomClock openedAt={live.meeting.openedAt} endsAt={live.meeting.endsAt} />}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p role="status" className={`hidden text-xs compact:block ${active ? "text-success" : "text-muted-foreground"}`}>{t(`phase.${live.phase}`)}</p>
        {inCall && projectId && returnHref && <Button variant="outline" className="min-h-10 gap-2 compact:hidden" disabled={!active} onClick={() => void copyLink()}><Link2 size={16} aria-hidden="true" />{t("copyMeetingLink")}</Button>}
        {inCall && endProjectId && <Button variant="destructive" className="min-h-10 gap-2 compact:hidden" disabled={!active} onClick={() => setEndOpen(true)}><PhoneOff size={16} aria-hidden="true" />{t("endForAll")}</Button>}
        {inCall && <Button variant={panel === "participants" ? "secondary" : "ghost"} className="hidden min-h-11 min-w-11 gap-1.5 compact:inline-flex" aria-label={t("participants")} aria-pressed={panel === "participants"} disabled={!active} onClick={() => void togglePanel("participants")}><Users size={18} aria-hidden="true" /><span className="tabular-nums">{people.length}</span></Button>}
      </div>
    </header>
    <div className={cn("space-y-2 empty:hidden", inCall && "compact:px-3 compact:pt-2")}>
      {live.error != null && <MeetingError error={live.error} />}{deviceError && <p role="alert" className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">{t(deviceError)}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
      {sharingSelf && <p role="status" className="rounded-lg border border-live/30 bg-live/10 px-3 py-2 text-sm">{t("screenSharing")}</p>}
      {room && !room.canPlaybackAudio && <Button variant="outline" className="min-h-11" onClick={() => void room.startAudio().catch(showDeviceError)}>{t("enableAudio")}</Button>}
    </div>
    {live.phase === "ready" ? <div className="workspace-panel mx-auto max-w-3xl p-4 sm:p-6"><PreJoinCheck onJoin={live.join} onPrefer={live.setPreferredDevice} /></div>
    : !inCall ? <section className="workspace-panel space-y-4 p-8"><h2 className="font-semibold">{t(`phase.${live.phase}`)}</h2>{live.phase === "failed" && <Button onClick={live.retry}>{t("retry")}</Button>}{returnHref && <Link href={returnHref} className="inline-flex min-h-11 items-center underline">{t("back")}</Link>}</section>
    : <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row compact:flex-col compact:gap-0">
        <section aria-label={t("videoGrid")} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 compact:gap-0 compact:p-2">
          {!people.length ? <div className="workspace-panel grid min-h-60 flex-1 place-items-center p-6 text-sm text-muted-foreground">{t(`phase.${live.phase}`)}</div>
            : compact ? <div className="flex min-h-0 flex-1 flex-col gap-2 landscape:flex-row">
              {sharing && <div className="flex min-h-0 min-w-0 flex-[3] flex-col gap-2">
                {shares.map(p => <ParticipantTile key={`${p.identity}:screen`} participant={p} monitor={monitor} source={Track.Source.ScreenShare} name={nameOf(p)} label={t("sharedScreenOf", { name: nameOf(p) })} className="aspect-video min-h-0 flex-1 compact:aspect-auto" />)}
              </div>}
              <div className={cn("grid min-w-0 gap-3 sm:grid-cols-2",
                sharing ? "flex h-24 shrink-0 gap-2 overflow-x-auto overscroll-contain landscape:h-auto landscape:w-32 landscape:flex-col landscape:overflow-x-hidden landscape:overflow-y-auto"
                  : cn("min-h-0 flex-1 gap-2", compactGrid(people.length)))}>{tiles}</div>
            </div>
            : <RoomStage people={people} shares={shares} monitor={monitor} mode={mode} onMode={setMode} pick={pick} onPick={setPick} describe={describe} screenLabel={name => t("sharedScreenOf", { name })} />}
        </section>
        {panel && <aside aria-label={t(panel)} onKeyDown={event => { if (event.key === "Escape") setPanel(null); }}
          className="workspace-panel flex max-h-[70dvh] min-w-0 flex-col overflow-hidden p-4 lg:max-h-none lg:w-80 lg:shrink-0 xl:w-96 compact:fixed compact:inset-x-0 compact:top-[calc(var(--vvt,0px)+var(--room-top))] compact:z-30 compact:h-[calc(var(--vvh,100dvh)-var(--room-top)-var(--room-bar))] compact:max-h-none compact:rounded-none compact:border-0 compact:px-3 compact:pb-3 compact:pt-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            {tabs
              ? <div role="tablist" aria-label={t("panelTabs")} className="flex min-w-0 flex-1 gap-5">
                {(["participants", "chat"] as const).map(tab => <button key={tab} type="button" role="tab" id={`room-tab-${tab}`} aria-selected={panel === tab} aria-controls="room-tabpanel" onClick={() => setPanel(tab)}
                  className={cn("-mb-px inline-flex min-h-10 cursor-pointer items-center gap-1.5 border-b-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    panel === tab ? "border-meeting text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t(tab)}{tab === "participants" && <span className="tabular-nums text-muted-foreground">({people.length})</span>}
                  {tab === "chat" && unread > 0 && panel !== "chat" && <span aria-hidden="true" className="grid h-4 min-w-4 place-items-center rounded-full bg-meeting px-1 text-[10px] font-semibold leading-none text-meeting-foreground">{unread > 9 ? "9+" : unread}</span>}
                </button>)}
              </div>
              : <h2 className="font-semibold">{t(panel)}</h2>}
            <Button variant="ghost" className="min-h-11 min-w-11" aria-label={t("closePanel")} onClick={() => setPanel(null)}><X size={18} aria-hidden="true" /></Button>
          </div>
          <div role={tabs ? "tabpanel" : undefined} id={tabs ? "room-tabpanel" : undefined} aria-labelledby={tabs ? `room-tab-${panel}` : undefined} className="flex min-h-0 flex-1 flex-col border-t pt-3">
            {panel === "participants" && <ParticipantsPanel live={live} room={room} inviteProjectId={inviteProjectId} onCopyLink={projectId && returnHref ? () => void copyLink() : undefined} organizerId={live.meeting?.organizerId} meetingId={id} />}
            {panel === "chat" && <ChatPanel live={live} active={active} content={content} setContent={setContent} mentions={mentions} setMentions={setMentions} sending={sending} onSend={send} />}
            {panel === "devices" && <DevicesPanel room={room} devices={devices} onSwitch={(kind, deviceId) => void live.switchDevice(kind, deviceId).catch(showDeviceError)} noise={live.noiseSuppressionSupported ? { enabled: live.noiseSuppression, onChange: enabled => void live.setNoiseSuppression(enabled).catch(showDeviceError) } : undefined} />}
          </div>
        </aside>}
      </div>
      <RoomControls active={active} mediaBusy={mediaBusy} mic={Boolean(room?.localParticipant.isMicrophoneEnabled)} camera={Boolean(room?.localParticipant.isCameraEnabled)}
        sharing={sharingSelf} screenBusy={screenBusy} screenSupported={canShareScreen()} panel={panel} unread={unread} keyboard={viewport.keyboard}
        canEndForAll={Boolean(endProjectId)} grid={mode === "grid"} onGrid={() => setMode(previous => previous === "grid" ? "focus" : "grid")}
        onMic={() => void media("mic")} onCamera={() => void media("camera")} onScreen={() => void toggleScreen()} onPanel={next => void togglePanel(next)}
        onEndForAll={() => setEndOpen(true)} onLeave={async () => { live.leave(); }} />
      {endProjectId && <ConfirmDialog open={endOpen} onOpenChange={setEndOpen} title={t("endTitle")} description={t("endConfirm")} confirmLabel={t("endConfirmLabel")} cancelLabel={t("endCancel")} destructive
        onConfirm={async () => { await meetingsApi.action(endProjectId, id, "end"); live.leave(); }} />}
    </>}
  </div></ParticipantMenuProvider>;
}
