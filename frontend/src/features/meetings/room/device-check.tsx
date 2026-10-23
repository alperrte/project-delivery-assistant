"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, CameraOff, Check, Headphones, Loader2, Mic, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DeviceSelect, deviceChoices } from "./device-select";
import { SpeechGate, rmsToDb } from "./speech-gate";

/**
 * The "ready to join" screen: a real camera and microphone check, entirely local. Nothing here connects to LiveKit or is
 * published; each check owns its own MediaStream (so the two work independently), and every stream is stopped on stop,
 * on device switch, on error, on join and on unmount. A result that arrives after any of those is discarded and its
 * tracks stopped, so a late permission answer can never leave a device open.
 */
type Kind = "audioinput" | "videoinput";
type CheckState = { status: "idle" | "starting" | "live" | "error"; error?: string };
const IDLE: CheckState = { status: "idle" };
const SEGMENTS = 12;
const SILENCE_HINT_MS = 3500;
/** Default level of the "hear myself" monitor: below full scale so a first switch-on is not a loud surprise. */
const MONITOR_DEFAULT = 60;

/** Maps a getUserMedia failure (or missing support) to one of the check's messages. */
export function checkErrorKey(failure: unknown): "testDenied" | "testMissing" | "testBusy" | "testFailed" {
  const name = failure instanceof Error ? failure.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "testDenied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "testMissing";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "testBusy";
  return "testFailed";
}
function unsupportedKey(): "testInsecure" | "testUnsupported" | undefined {
  if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") return undefined;
  return typeof window !== "undefined" && !window.isSecureContext ? "testInsecure" : "testUnsupported";
}
const stopStream = (stream: MediaStream | undefined) => stream?.getTracks().forEach(track => track.stop());

export function PreJoinCheck({ onJoin, onPrefer }: { onJoin: () => void; onPrefer: (kind: Kind, deviceId: string | undefined) => void }) {
  const t = useTranslations("meetings");
  const [camera, setCamera] = useState<CheckState>(IDLE), [mic, setMic] = useState<CheckState>(IDLE);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState(""), [micId, setMicId] = useState("");
  const [segments, setSegments] = useState(0), [heard, setHeard] = useState(false), [quiet, setQuiet] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | undefined>(undefined), micStream = useRef<MediaStream | undefined>(undefined);
  const cameraRun = useRef(0), micRun = useRef(0);
  const meter = useRef<{ context: AudioContext; frame: number; hint: ReturnType<typeof setTimeout>; input: MediaStreamAudioSourceNode; monitor: GainNode; monitoring: boolean } | undefined>(undefined);
  // "Hear myself": the microphone is played back on this device only (Web Audio), off by default and never part of any call.
  const [hearSelf, setHearSelf] = useState(false), [monitorVolume, setMonitorVolume] = useState(MONITOR_DEFAULT);
  const hearRef = useRef(false), volumeRef = useRef(MONITOR_DEFAULT);
  const alive = useRef(true);
  // The latest choice and callback, readable from the device-change listener without re-subscribing.
  const chosen = useRef({ camera: "", mic: "" }), onPreferRef = useRef(onPrefer);
  useEffect(() => { onPreferRef.current = onPrefer; });

  const refreshDevices = useCallback(async () => {
    try {
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput" || d.kind === "videoinput");
      if (!alive.current) return;
      setDevices(list);
      // A chosen device that was unplugged falls back to the default, on screen and for joining.
      const gone = (kind: Kind, id: string) => id && !deviceChoices(list, kind).some(device => device.deviceId === id);
      if (gone("videoinput", chosen.current.camera)) { chosen.current.camera = ""; setCameraId(""); onPreferRef.current("videoinput", undefined); }
      if (gone("audioinput", chosen.current.mic)) { chosen.current.mic = ""; setMicId(""); onPreferRef.current("audioinput", undefined); }
    } catch { /* the lists stay as they were */ }
  }, []);

  const endCamera = useCallback((next: CheckState) => {
    cameraRun.current++;
    stopStream(cameraStream.current); cameraStream.current = undefined;
    if (video.current) video.current.srcObject = null;
    if (alive.current) setCamera(next);
  }, []);
  const endMic = useCallback((next: CheckState, keepMonitor = false) => {
    micRun.current++;
    const active = meter.current; meter.current = undefined;
    if (active) { cancelAnimationFrame(active.frame); clearTimeout(active.hint); if (active.monitoring) { active.monitor.disconnect(); active.input.disconnect(active.monitor); } void active.context.close().catch(() => {}); }
    if (!keepMonitor) { hearRef.current = false; if (alive.current) setHearSelf(false); }
    stopStream(micStream.current); micStream.current = undefined;
    if (alive.current) { setMic(next); setSegments(0); setHeard(false); setQuiet(false); }
  }, []);

  async function startCamera(deviceId = cameraId) {
    const unsupported = unsupportedKey();
    if (unsupported) { endCamera({ status: "error", error: unsupported }); return; }
    endCamera({ status: "starting" });
    const run = cameraRun.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true });
      if (run !== cameraRun.current || !alive.current) { stopStream(stream); return; }
      cameraStream.current = stream;
      const track = stream.getVideoTracks()[0];
      track?.addEventListener("ended", () => { if (cameraStream.current === stream) endCamera({ status: "error", error: "testLost" }); });
      if (video.current) { video.current.srcObject = stream; void video.current.play().catch(() => {}); }
      setCamera({ status: "live" });
      void refreshDevices();
    } catch (failure) {
      if (run === cameraRun.current && alive.current) setCamera({ status: "error", error: checkErrorKey(failure) });
    }
  }

  /** Connects or disconnects the playback of the microphone to this device's speakers; nothing else ever touches the destination. */
  function applyMonitor(on: boolean) {
    const active = meter.current; hearRef.current = on; setHearSelf(on);
    if (!active || active.monitoring === on) return;
    if (on) { active.monitor.gain.value = volumeRef.current / 100; active.input.connect(active.monitor); active.monitor.connect(active.context.destination); }
    else { active.monitor.disconnect(); active.input.disconnect(active.monitor); }
    active.monitoring = on;
  }
  function changeMonitorVolume(value: number) {
    volumeRef.current = value; setMonitorVolume(value);
    if (meter.current) meter.current.monitor.gain.value = value / 100;
  }

  async function startMic(deviceId = micId, restoreMonitor = false) {
    const unsupported = unsupportedKey();
    if (unsupported) { endMic({ status: "error", error: unsupported }); return; }
    endMic({ status: "starting" }, restoreMonitor);
    const run = micRun.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
      if (run !== micRun.current || !alive.current) { stopStream(stream); return; }
      micStream.current = stream;
      const track = stream.getAudioTracks()[0];
      track?.addEventListener("ended", () => { if (micStream.current === stream) endMic({ status: "error", error: "testLost" }); });
      // The level comes straight from the microphone's samples (Web Audio), the same kind of measurement the speaking ring uses.
      const context = new AudioContext(); void context.resume().catch(() => {});
      const input = context.createMediaStreamSource(stream);
      const highpass = context.createBiquadFilter(); highpass.type = "highpass"; highpass.frequency.value = 150;
      const analyser = context.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0;
      input.connect(highpass); highpass.connect(analyser);
      const samples = new Float32Array(analyser.fftSize), gate = new SpeechGate();
      let shown = -1, voiced = false;
      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0; for (const sample of samples) sum += sample * sample;
        const db = rmsToDb(Math.sqrt(sum / samples.length));
        // -60 dBFS (very quiet room tone) .. -15 dBFS (loud speech) fills the bar; quiet speech still moves it clearly.
        const next = Math.round(Math.max(0, Math.min(1, (db + 60) / 45)) * SEGMENTS);
        if (next !== shown) { shown = next; setSegments(next); }
        if (!voiced && gate.update(db, performance.now())) { voiced = true; setHeard(true); setQuiet(false); }
        if (meter.current) meter.current.frame = requestAnimationFrame(tick);
      };
      const hint = setTimeout(() => { if (!voiced && micStream.current === stream) setQuiet(true); }, SILENCE_HINT_MS);
      const monitor = context.createGain();
      meter.current = { context, frame: requestAnimationFrame(tick), hint, input, monitor, monitoring: false };
      setMic({ status: "live" });
      if (restoreMonitor) applyMonitor(true);
      void refreshDevices();
    } catch (failure) {
      if (run === micRun.current && alive.current) setMic({ status: "error", error: checkErrorKey(failure) });
    }
  }

  // The lists of devices follow plugging and unplugging while this screen is open.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) return;
    const onChange = () => { void refreshDevices(); };
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, [refreshDevices]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; endCamera(IDLE); endMic(IDLE); };
  }, [endCamera, endMic]);

  function chooseDevice(kind: Kind, deviceId: string) {
    onPrefer(kind, deviceId || undefined);
    if (kind === "videoinput") { chosen.current.camera = deviceId; setCameraId(deviceId); if (camera.status === "live") void startCamera(deviceId); }
    else { chosen.current.mic = deviceId; setMicId(deviceId); if (mic.status === "live") void startMic(deviceId, hearRef.current); }
  }

  const message = (state: CheckState, kind: Kind) => state.error ? t(state.error, { device: t(kind) }) : undefined;
  const select = (kind: Kind, value: string) => <DeviceSelect kind={kind} devices={devices} value={value} testId={`${kind}-select`} onChange={deviceId => chooseDevice(kind, deviceId)} />;

  return <div className="grid gap-6 md:grid-cols-2">
    <div className="space-y-4">
      <section aria-label={t("cameraCheck")} className="space-y-3">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border bg-surface-2">
          <video ref={video} autoPlay muted playsInline data-testid="camera-check-video" className={cn("h-full w-full object-contain", camera.status !== "live" && "invisible")} />
          {camera.status !== "live" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            {camera.status === "starting" ? <><Loader2 size={24} className="animate-spin" aria-hidden="true" /><p role="status">{t("camStarting")}</p></>
              : camera.status === "error" ? <><CameraOff size={24} aria-hidden="true" /><p role="alert" className="text-foreground">{message(camera, "videoinput")}</p></>
                : <><Camera size={24} aria-hidden="true" /><p>{t("camIdleHint")}</p></>}
          </div>}
          {camera.status === "live" && <span role="status" className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-xs"><span aria-hidden="true" className="size-2 rounded-full bg-live" />{t("camActive")}</span>}
        </div>
        {select("videoinput", cameraId)}
        <Button variant={camera.status === "live" ? "secondary" : "outline"} className="min-h-11 w-full sm:w-auto" aria-busy={camera.status === "starting" || undefined} disabled={camera.status === "starting"}
          onClick={() => camera.status === "live" ? endCamera(IDLE) : void startCamera()}>
          {camera.status === "starting" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{t(camera.status === "live" ? "stopTest" : "previewCamera")}
        </Button>
      </section>
      <section aria-label={t("micCheck")} className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center gap-3">
          <Mic size={20} className={cn("shrink-0", mic.status === "live" ? "text-live" : "text-muted-foreground")} aria-hidden="true" />
          <div role="meter" aria-label={t("micLevel")} aria-valuemin={0} aria-valuemax={SEGMENTS} aria-valuenow={segments} data-testid="mic-level" data-level={segments}
            className="flex h-4 flex-1 items-end gap-0.5">
            {Array.from({ length: SEGMENTS }, (_, index) => <span key={index} aria-hidden="true"
              className={cn("h-full flex-1 rounded-sm bg-muted transition-colors duration-75", index < segments && (index >= SEGMENTS - 2 ? "bg-warning" : "bg-success"))} />)}
          </div>
        </div>
        <div aria-live="polite" className="min-h-10 text-sm" data-testid="mic-status">
          {mic.status === "starting" && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 size={14} className="animate-spin" aria-hidden="true" />{t("micStarting")}</p>}
          {mic.status === "error" && <p role="alert" className="text-foreground">{message(mic, "audioinput")}</p>}
          {mic.status === "live" && <>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden="true" className="size-2 rounded-full bg-live" />{t("micActive")}</p>
            {heard ? <p className="mt-1 flex items-center gap-1.5 font-medium text-success"><Check size={16} aria-hidden="true" />{t("micHeard")}</p>
              : <p className="mt-1 text-muted-foreground">{t(quiet ? "micSilent" : "micListening")}</p>}
          </>}
        </div>
        {select("audioinput", micId)}
        <div className="space-y-2 rounded-lg bg-surface-2 p-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <Checkbox checked={hearSelf} disabled={mic.status !== "live"} onCheckedChange={on => applyMonitor(on)} className="mt-0.5" data-testid="hear-self" />
            <span className="space-y-0.5"><span className="flex items-center gap-1.5 font-medium"><Headphones size={15} aria-hidden="true" />{t("hearSelf")}</span>
              <span className="block text-xs leading-5 text-muted-foreground">{t("hearSelfHint")}</span></span>
          </label>
          {hearSelf && <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="shrink-0">{t("hearSelfVolume")}</span>
            <input type="range" min={0} max={100} value={monitorVolume} onChange={event => changeMonitorVolume(Number(event.target.value))} className="w-full accent-meeting" aria-label={t("hearSelfVolume")} />
            <span aria-hidden="true" className="w-8 shrink-0 text-right tabular-nums">{monitorVolume}</span>
          </label>}
        </div>
        <Button variant={mic.status === "live" ? "secondary" : "outline"} className="min-h-11 w-full sm:w-auto" aria-busy={mic.status === "starting" || undefined} disabled={mic.status === "starting"}
          onClick={() => mic.status === "live" ? endMic(IDLE) : void startMic()}>
          {mic.status === "starting" && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{t(mic.status === "live" ? "stopTest" : "testMicrophone")}
        </Button>
      </section>
    </div>
    <div className="flex flex-col items-start gap-4">
      <Video size={28} className="text-primary" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{t("readyTitle")}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{t("joinPrivacy")}</p>
      <p className="text-xs leading-5 text-muted-foreground">{t("testPrivacy")}</p>
      <Button className="min-h-11" onClick={() => { endCamera(IDLE); endMic(IDLE); onJoin(); }}>{t("join")}</Button>
    </div>
  </div>;
}
