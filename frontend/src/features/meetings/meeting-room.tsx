"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LocalParticipant, Participant, RemoteParticipant, Track } from "livekit-client";
import { Camera, CameraOff, Mic, MicOff, MonitorUp, PhoneOff, Users, MessageSquare, Video } from "lucide-react";
import Link from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { meetingsApi } from "./api";
import { MeetingError, useMeetingProject } from "./shared";
import { useMeetingRoom } from "./use-meeting-room";

function MediaTile({ participant, source = Track.Source.Camera, label }: { participant: Participant; source?: Track.Source; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const track = participant.getTrackPublication(source)?.track;
  const enabled = track && !track.isMuted;
  useEffect(() => {
    if (!track || !enabled || !ref.current) return;
    const element = track.attach(); element.className = "h-full w-full object-contain";
    if (element instanceof HTMLVideoElement) { element.playsInline = true; element.muted = participant instanceof LocalParticipant; }
    ref.current.appendChild(element);
    return () => { track.detach(element); element.remove(); };
  }, [track, enabled, participant]);
  return <div className={`relative flex aspect-video min-w-0 items-center justify-center overflow-hidden rounded-xl border bg-surface-2 ${participant.isSpeaking ? "ring-2 ring-live" : ""}`}>
    <div ref={ref} className="absolute inset-0" />
    {!enabled && <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-primary/15 text-2xl font-semibold text-primary">{(participant.name ?? participant.identity).slice(0, 2).toLocaleUpperCase()}</span>}
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-card/90 px-3 py-2 text-xs"><span className="truncate">{label}</span>{!participant.isMicrophoneEnabled && <MicOff size={13} className="ml-auto shrink-0" aria-label="" />}</div>
  </div>;
}
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
  return <MeetingRoom key={`${context.user.id}:${context.project.id}:${id}`} id={id} projectId={context.project.id} isManager={context.isManager} returnHref={`/projects/${slug}/meetings/${id}`} />;
}
export function MeetingRoom({ id, projectId, isManager = false, returnHref }: { id: string; projectId?: string; isManager?: boolean; returnHref?: string }) {
  const t = useTranslations("meetings"), live = useMeetingRoom(id, projectId);
  const [panel, setPanel] = useState<"participants" | "chat" | "devices" | null>(null);
  const [content, setContent] = useState(""), [mentions, setMentions] = useState<string[]>([]);
  const [sending, setSending] = useState(false), [mediaBusy, setMediaBusy] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceError, setDeviceError] = useState<string>();
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string>();
  const preview = useRef<HTMLVideoElement>(null), previewTracks = useRef<MediaStream | undefined>(undefined);
  const previewGeneration = useRef(0);
  const active = live.phase === "connected", room = live.room;
  const remote = room ? [...room.remoteParticipants.values()] : [];
  const people: Participant[] = room ? [room.localParticipant, ...remote] : [];
  const shares = people.filter(p => p.isScreenShareEnabled);
  useEffect(() => {
    if (panel !== "devices" || !navigator.mediaDevices) return;
    let alive = true;
    const refresh = () => { void navigator.mediaDevices.enumerateDevices().then(value => { if (alive) setDevices(value); }).catch(() => {}); };
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => { alive = false; navigator.mediaDevices.removeEventListener("devicechange", refresh); };
  }, [panel]);
  const lookup = new Map(live.participants.map(p => [p.identity, p]));
  function stopPreview() { previewGeneration.current++; previewTracks.current?.getTracks().forEach(track => track.stop()); previewTracks.current = undefined; if (preview.current) preview.current.srcObject = null; }
  useEffect(() => { const tracks = previewTracks, generation = previewGeneration; return () => { generation.current++; tracks.current?.getTracks().forEach(track => track.stop()); }; }, []);
  async function startPreview(microphone = false) {
    stopPreview(); const generation = previewGeneration.current;
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: !microphone, audio: microphone }); if (generation !== previewGeneration.current) { stream.getTracks().forEach(track => track.stop()); return; } previewTracks.current = stream; if (preview.current) preview.current.srcObject = stream; setDeviceError(undefined); setNotice(microphone ? t("microphoneReady") : undefined); }
    catch (failure) { showDeviceError(failure); }
  }
  function showDeviceError(failure: unknown) {
    const name = failure instanceof Error ? failure.name : "";
    setDeviceError(name === "NotAllowedError" || name === "SecurityError" ? "permissionDenied" : name === "NotFoundError" ? "deviceMissing" : name === "NotReadableError" ? "deviceBusy" : "deviceError");
  }
  async function media(kind: "mic" | "camera" | "screen") {
    if (!room || mediaBusy) return;
    setMediaBusy(true); setDeviceError(undefined);
    try {
      if (kind === "mic") { const enabled = !room.localParticipant.isMicrophoneEnabled; await room.localParticipant.setMicrophoneEnabled(enabled); live.setIntent("mic", enabled); }
      else if (kind === "camera") { const enabled = !room.localParticipant.isCameraEnabled; await room.localParticipant.setCameraEnabled(enabled); live.setIntent("camera", enabled); }
      else await room.localParticipant.setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled, { audio: true });
    } catch (failure) { showDeviceError(failure); } finally { setMediaBusy(false); }
  }
  async function showDevices() {
    setPanel(previous => previous === "devices" ? null : "devices");
    try { setDevices(await navigator.mediaDevices.enumerateDevices()); } catch (failure) { showDeviceError(failure); }
  }
  async function send() {
    if (!content.trim() || sending) return; setSending(true);
    try { await live.send(content.trim(), mentions); setContent(""); setMentions([]); live.setError(undefined); }
    catch (failure) { live.setError(failure); } finally { setSending(false); }
  }
  const mentionQuery = /(?:^|\s)@([^@\n]*)$/.exec(content)?.[1];
  const suggestions = mentionQuery === undefined ? [] : live.participants.filter(p => p.connected && !p.revoked && p.id !== live.selfId && p.displayName.toLocaleLowerCase().includes(mentionQuery.toLocaleLowerCase())).slice(0, 8);
  function tool(label: string, icon: React.ReactNode, action: () => void, pressed?: boolean, destructive = false) {
    return <Tooltip key={label}><TooltipTrigger render={<Button variant={destructive ? "destructive" : pressed ? "secondary" : "outline"} className="min-h-11 min-w-11" aria-label={label} aria-pressed={pressed} disabled={!active || mediaBusy} onClick={action}>{icon}</Button>} /><TooltipContent>{label}</TooltipContent></Tooltip>;
  }
  return <div className="min-w-0 space-y-4" data-meeting-room>
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="break-words text-xl font-semibold">{live.meeting?.title ?? t("group")}</h1>{live.meeting && <RoomClock openedAt={live.meeting.openedAt} endsAt={live.meeting.endsAt} />}</div><p role="status" className={`text-sm ${active ? "text-success" : "text-muted-foreground"}`}>{t(`phase.${live.phase}`)}</p></header>
    {live.error != null && <MeetingError error={live.error} />}{deviceError && <p role="alert" className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">{t(deviceError)}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
    {live.phase === "ready" ? <div className="workspace-panel mx-auto grid max-w-3xl gap-6 p-6 md:grid-cols-2"><div><div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-surface-2"><video ref={preview} autoPlay muted playsInline className="h-full w-full object-contain" /></div><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void startPreview()}>{t("previewCamera")}</Button><Button variant="outline" onClick={() => void startPreview(true)}>{t("testMicrophone")}</Button><Button variant="ghost" onClick={stopPreview}>{t("stopPreview")}</Button></div></div><div className="flex flex-col items-start gap-4"><Video size={28} className="text-primary" /><h2 className="text-lg font-semibold">{t("readyTitle")}</h2><p className="text-sm leading-6 text-muted-foreground">{t("joinPrivacy")}</p><Button className="min-h-11" onClick={() => { stopPreview(); live.join(); }}>{t("join")}</Button></div></div> : ["left", "closed", "removed", "failed"].includes(live.phase) ? <section className="workspace-panel space-y-4 p-8"><h2 className="font-semibold">{t(`phase.${live.phase}`)}</h2>{live.phase === "failed" && <Button onClick={live.retry}>{t("retry")}</Button>}{returnHref && <Link href={returnHref} className="inline-flex min-h-11 items-center underline">{t("back")}</Link>}</section> : <>
      <div className={`grid min-w-0 gap-4 ${panel ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <section aria-label={t("videoGrid")} className="order-1 min-w-0 space-y-4">
          {shares.map(p => <MediaTile key={`${p.identity}:screen`} participant={p} source={Track.Source.ScreenShare} label={`${lookup.get(p.identity)?.displayName ?? p.name ?? p.identity} · ${t("screen")}`} />)}
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">{people.map(p => <MediaTile key={p.identity} participant={p} label={`${lookup.get(p.identity)?.displayName ?? p.name ?? t("member")}${p === room?.localParticipant ? ` (${t("you")})` : ""}`} />)}</div>
          {!people.length && <div className="workspace-panel grid min-h-60 place-items-center p-6 text-sm text-muted-foreground">{t(`phase.${live.phase}`)}</div>}
          {remote.map(p => <RemoteAudio key={p.identity} participant={p} volume={(volumes[p.identity] ?? 100) / 100} />)}
          {room && !room.canPlaybackAudio && <Button variant="outline" onClick={() => void room.startAudio().catch(showDeviceError)}>{t("enableAudio")}</Button>}
        </section>
        {panel && <aside className="workspace-panel order-3 flex max-h-[70dvh] min-w-0 flex-col overflow-hidden p-4 xl:order-2 xl:sticky xl:top-24"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-semibold">{t(panel)}</h2><Button variant="ghost" aria-label={t("closePanel")} onClick={() => setPanel(null)}>×</Button></div>
          {panel === "participants" && <ul className="space-y-4 overflow-y-auto">{live.participants.filter(p => !p.revoked && (p.connected || p.id === live.selfId)).map(p => <li key={p.id} className="space-y-2 border-t pt-3"><p className="break-words text-sm font-medium">{p.displayName}{p.id === live.selfId ? ` (${t("you")})` : ""}{p.guest ? ` (${t("guest")})` : ""}</p>{p.id !== live.selfId && <><label className="block space-y-2 text-xs text-muted-foreground">{t("volume")}<input className="w-full accent-primary" type="range" min={0} max={100} value={volumes[p.identity] ?? 100} onChange={e => { const volume = Number(e.target.value); room?.remoteParticipants.get(p.identity)?.setVolume(volume / 100); setVolumes(previous => ({ ...previous, [p.identity]: volume })); }} /></label>{isManager && projectId && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={async () => { try { await meetingsApi.moderate(projectId, id, p.id, "mute"); setNotice(t("muted")); } catch (failure) { live.setError(failure); } }}>{t("muteParticipant")}</Button><ConfirmDialog trigger={<Button size="sm" variant="ghost" className="text-destructive">{t("kick")}</Button>} title={t("kick")} description={t("kickConfirm")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} destructive onConfirm={async () => { await meetingsApi.moderate(projectId, id, p.id, "kick"); setNotice(t("rotationNotice")); }} /></div>}</>}</li>)}</ul>}
          {panel === "chat" && <><p className="mb-3 text-xs leading-5 text-muted-foreground">{t(live.retained ? "chatRetained" : "chatTemporary")}</p><div role="log" aria-label={t("chat")} aria-live="polite" className="min-h-40 flex-1 space-y-4 overflow-y-auto">{live.hasOlder && <Button variant="ghost" onClick={() => void live.older()?.catch(live.setError)}>{t("olderMessages")}</Button>}{!live.messages.length && <p className="text-sm text-muted-foreground">{t("emptyChat")}</p>}{live.messages.map(message => <article key={message.id} className={`rounded-lg p-3 ${message.mentionIds.includes(live.selfId) ? "border border-primary/40 bg-primary/10" : "bg-muted/50"}`}><div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="break-words font-medium text-foreground">{message.displayName}</span><time dateTime={message.sentAt}>{new Date(message.sentAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time></div><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p></article>)}</div>
            <form onSubmit={e => { e.preventDefault(); void send(); }} className="mt-3 space-y-2 border-t pt-3"><label htmlFor="meeting-message" className="sr-only">{t("message")}</label><textarea id="meeting-message" className="min-h-20 w-full resize-y rounded-md border bg-background p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" maxLength={2000} value={content} onChange={e => setContent(e.target.value)} disabled={!active || sending} />{suggestions.length > 0 && <div role="group" aria-label={t("mentions")} className="max-h-32 overflow-auto rounded-md border">{suggestions.map(p => <Button key={p.id} type="button" variant="ghost" className="min-h-11 w-full justify-start whitespace-normal" disabled={mentions.length >= 20 && !mentions.includes(p.id)} onClick={() => { setContent(previous => previous.replace(/@[^@\n]*$/, `@${p.displayName} `)); setMentions(previous => [...new Set([...previous, p.id])]); }}>{p.displayName}</Button>)}</div>}{mentions.length > 0 && <div className="flex flex-wrap gap-1">{mentions.map(mention => <Button key={mention} type="button" size="sm" variant="secondary" onClick={() => setMentions(previous => previous.filter(m => m !== mention))}>{live.participants.find(p => p.id === mention)?.displayName ?? t("mention")} ×</Button>)}</div>}<div className="flex items-center justify-between gap-2"><span className="text-xs tabular-nums text-muted-foreground">{content.length}/2000</span><Button type="submit" disabled={!active || sending || !content.trim()}>{t("send")}</Button></div></form></>}
          {panel === "devices" && <div className="space-y-4 overflow-y-auto">{(["audioinput", "videoinput", "audiooutput"] as const).map(kind => <label key={kind} className="block space-y-2 text-sm">{t(kind)}<select className="min-h-11 w-full rounded-md border bg-background px-3 text-sm" defaultValue={room?.getActiveDevice(kind)} onChange={e => void live.switchDevice(kind, e.target.value).catch(showDeviceError)}><option value="default">{t("defaultDevice")}</option>{devices.filter(d => d.kind === kind && d.deviceId && d.deviceId !== "default").map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t(kind)} ${i + 1}`}</option>)}</select></label>)}<p className="text-xs leading-5 text-muted-foreground">{t("deviceHint")}</p></div>}
        </aside>}
      <footer className={`sticky bottom-3 z-10 order-2 flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-card p-3 shadow-lg xl:order-3 ${panel ? "xl:col-span-2" : ""}`}>
        {tool(t(room?.localParticipant.isMicrophoneEnabled ? "micOff" : "micOn"), room?.localParticipant.isMicrophoneEnabled ? <Mic size={19} /> : <MicOff size={19} />, () => void media("mic"), room?.localParticipant.isMicrophoneEnabled)}
        {tool(t(room?.localParticipant.isCameraEnabled ? "cameraOff" : "cameraOn"), room?.localParticipant.isCameraEnabled ? <Camera size={19} /> : <CameraOff size={19} />, () => void media("camera"), room?.localParticipant.isCameraEnabled)}
        {tool(t("screen"), <MonitorUp size={19} />, () => void media("screen"), room?.localParticipant.isScreenShareEnabled)}
        {tool(t("participants"), <Users size={19} />, () => setPanel(previous => previous === "participants" ? null : "participants"), panel === "participants")}
        {tool(t("chat"), <MessageSquare size={19} />, () => setPanel(previous => previous === "chat" ? null : "chat"), panel === "chat")}
        <Button variant="outline" className="min-h-11" disabled={!active} onClick={() => void showDevices()}>{t("devices")}</Button>
        <Button variant="destructive" className="min-h-11" onClick={() => { stopPreview(); live.leave(); }}><PhoneOff size={18} />{t("leave")}</Button>
        {isManager && projectId && <ConfirmDialog trigger={<Button variant="ghost" className="min-h-11 text-destructive">{t("endForAll")}</Button>} title={t("endForAll")} description={t("endConfirm")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} destructive onConfirm={async () => { await meetingsApi.action(projectId, id, "end"); live.leave(); }} />}
      </footer>
      </div>
    </>}
  </div>;
}
