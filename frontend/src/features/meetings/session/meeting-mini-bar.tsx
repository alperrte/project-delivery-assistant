"use client";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Participant, Track } from "livekit-client";
import { Camera, CameraOff, GripHorizontal, Loader2, Mic, MicOff, MonitorUp, PhoneOff, Video } from "lucide-react";
import Link, { usePathname } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { profilePhotoSrc } from "@/features/account/api";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "../room/use-visual-viewport";
import { deviceErrorKey, isInCallPhase, useOptionalMeetingSession, type SessionLive } from "./meeting-session";

const GAP = 8;
const POSITION_KEY = "pda:meeting-mini-window:v1";
// Track sources by value: this file ships with every workspace page, so it must not import the LiveKit SDK itself.
const CAMERA = "camera" as unknown as Track.Source, SCREEN = "screen_share" as unknown as Track.Source;

type Position = { x: number; y: number };
function readPosition(): Position | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(POSITION_KEY) ?? "null") as Position | null;
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? value : null;
  } catch { return null; }
}
function writePosition(position: Position | null) {
  try { if (position) window.localStorage.setItem(POSITION_KEY, JSON.stringify(position)); else window.localStorage.removeItem(POSITION_KEY); } catch { /* the position then simply is not remembered */ }
}
/** Keeps the whole window inside the screen, below the floating navbar. */
function clampPosition(position: Position, width: number, height: number): Position {
  const root = getComputedStyle(document.documentElement);
  const reserve = (parseFloat(root.getPropertyValue("--workspace-header-reserve")) || 0) * (parseFloat(root.fontSize) || 16);
  return {
    x: Math.round(Math.min(Math.max(position.x, GAP), Math.max(GAP, window.innerWidth - width - GAP))),
    y: Math.round(Math.min(Math.max(position.y, Math.max(GAP, reserve)), Math.max(GAP, window.innerHeight - height - GAP))),
  };
}

/**
 * Keeps the bar clear of the other fixed things at the bottom of the screen, measured from where they really are:
 * the chat dock (title bar or compact window) when it overlaps the bar horizontally, and the on-screen keyboard, which
 * covers the bottom of the page without resizing it. The bar sits above them (never under, never over). It also
 * publishes how much room it takes, so the chat can leave it free: `--meeting-mini-height` (its own height) shrinks the
 * compact chat window, `--meeting-mini-reserve` (distance from the screen bottom to its top) lifts the full chat panel.
 * Once the person has dragged the window somewhere, this no longer applies: they placed it.
 */
function useBottomClearance(ref: RefObject<HTMLElement | null>, keyboardLift: number, visible: boolean) {
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!visible || !bar) return;
    const root = document.documentElement;
    let frame: number | null = null;
    const watched = new Set<Element>();
    const resize = new ResizeObserver(() => schedule());
    const attributes = new MutationObserver(() => schedule());
    function measure() {
      frame = null;
      const mine = bar!.getBoundingClientRect();
      const fullChat = document.querySelector("[data-chat-full]");
      let lift = keyboardLift > 0 ? keyboardLift + GAP : 0;
      const docks = fullChat ? [] : [...document.querySelectorAll<HTMLElement>("[data-chat-dock]")];
      for (const dock of docks) {
        // Layout box, not the painted one: the chat windows animate in with a scale that would under-measure them.
        const bottom = parseFloat(getComputedStyle(dock).bottom) || 0;
        if (dock.offsetWidth > 0 && dock.offsetLeft < mine.right && dock.offsetLeft + dock.offsetWidth > mine.left) lift = Math.max(lift, bottom + dock.offsetHeight + GAP);
      }
      // Never rise under the floating navbar: the compact chat window shrinks to leave this room (see chat-dock.tsx).
      const reserve = parseFloat(getComputedStyle(root).getPropertyValue("--workspace-header-reserve")) * (parseFloat(getComputedStyle(root).fontSize) || 16) || 0;
      const ceiling = Math.max(0, window.innerHeight - reserve - mine.height);
      const value = lift > 0 ? `${Math.min(lift, ceiling)}px` : "";
      if (bar!.style.bottom !== value) bar!.style.bottom = value;
      const top = bar!.getBoundingClientRect().top;
      root.style.setProperty("--meeting-mini-height", `${Math.ceil(mine.height + GAP)}px`);
      root.style.setProperty("--meeting-mini-reserve", `${Math.ceil(window.innerHeight - top + GAP)}px`);
      for (const dock of docks) if (!watched.has(dock)) { watched.add(dock); resize.observe(dock); attributes.observe(dock, { attributes: true, attributeFilter: ["style", "class"] }); }
    }
    function schedule() { if (frame === null) frame = requestAnimationFrame(measure); }
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    resize.observe(bar);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    measure();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resize.disconnect(); attributes.disconnect(); mutations.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      root.style.removeProperty("--meeting-mini-height");
      root.style.removeProperty("--meeting-mini-reserve");
      bar.style.bottom = "";
    };
  }, [ref, keyboardLift, visible]);
}

/** Dragging by pointer or keyboard; the position is remembered and always clamped into the screen. */
function useDraggable(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const latest = useRef<Position | null>(null);
  // The remembered position is read after mount (not during the first render) and clamped to the current screen.
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    const stored = readPosition();
    if (stored) { const box = ref.current.getBoundingClientRect(); const clamped = clampPosition(stored, Math.min(box.width, 320), box.height); latest.current = clamped; setPosition(clamped); }
  }, [enabled, ref]);
  useEffect(() => {
    if (!enabled) return;
    const refit = () => setPosition(current => { if (!current || !ref.current) return current; const box = ref.current.getBoundingClientRect(); const next = clampPosition(current, box.width, box.height); latest.current = next; return next; });
    window.addEventListener("resize", refit); window.visualViewport?.addEventListener("resize", refit);
    return () => { window.removeEventListener("resize", refit); window.visualViewport?.removeEventListener("resize", refit); };
  }, [enabled, ref]);
  const place = (next: Position) => {
    const box = ref.current?.getBoundingClientRect(); if (!box) return;
    const clamped = clampPosition(next, box.width, box.height); latest.current = clamped; setPosition(clamped);
  };
  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const box = ref.current?.getBoundingClientRect(); if (!box) return;
      drag.current = { id: event.pointerId, dx: event.clientX - box.left, dy: event.clientY - box.top };
      event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const active = drag.current; if (!active || active.id !== event.pointerId) return;
      place({ x: event.clientX - active.dx, y: event.clientY - active.dy });
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (drag.current?.id !== event.pointerId) return;
      drag.current = null; setDragging(false); writePosition(latest.current);
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const step = event.shiftKey ? 64 : 16, box = ref.current?.getBoundingClientRect(); if (!box) return;
      const moves: Record<string, Position> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
      if (event.key === "Home") { event.preventDefault(); latest.current = null; setPosition(null); writePosition(null); return; }
      const move = moves[event.key]; if (!move) return;
      event.preventDefault(); place({ x: (position?.x ?? box.left) + move.x, y: (position?.y ?? box.top) + move.y }); writePosition(latest.current);
    },
  };
  return { position, dragging, handlers, reset: () => { latest.current = null; setPosition(null); writePosition(null); } };
}

/** The picture in the window: a running screen share first, then the first remote camera that is on, then the first person, then you. */
function MiniFeed({ live }: { live: SessionLive }) {
  const room = live.room, ref = useRef<HTMLDivElement>(null);
  const remote = room ? [...room.remoteParticipants.values()] : [];
  const shown: Participant | undefined = remote.find(p => p.isScreenShareEnabled) ?? remote.find(p => p.isCameraEnabled) ?? remote[0] ?? room?.localParticipant;
  const screen = !!shown?.isScreenShareEnabled && !shown.isLocal;
  const track = shown?.getTrackPublication(screen ? SCREEN : CAMERA)?.track, enabled = !!track && !track.isMuted;
  const view = live.participants.find(p => p.identity === shown?.identity), name = view?.displayName ?? shown?.name ?? "";
  useEffect(() => {
    if (!track || !enabled || !ref.current || !shown) return;
    const element = track.attach();
    element.className = cn("h-full w-full", screen ? "object-contain" : "object-cover");
    if (element instanceof HTMLVideoElement) { element.playsInline = true; element.muted = shown.isLocal; }
    ref.current.appendChild(element);
    return () => { track.detach(element); element.remove(); };
  }, [track, enabled, shown, screen]);
  return <div data-mini-feed={shown?.identity} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-2">
    <div ref={ref} className={cn("absolute inset-0", screen && "bg-black")} />
    {!enabled && name && <Avatar name={name} src={view?.userId ? profilePhotoSrc(view.userId, view.profilePhotoVersion) : null} title={false} className="size-14 text-lg ring-0" />}
    {name && <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-xs text-white">{name}</span>}
  </div>;
}

/**
 * The call while another workspace page is open, as a small floating video window: the picture of the call, what is running, one
 * tap back to the room, the two everyday media toggles and Leave (with the same confirmation as in the room). Hidden on the room
 * page itself, which has the full bar. By default it sits bottom-left on desktop (the chat dock lives bottom-right) and full width
 * on phones, lifted above sticky save bars and above the chat dock; with the keyboard open it shrinks to the four controls and
 * rides above the keyboard. The picture area is a handle: drag it (pointer or touch) or use the arrow keys, Home puts it back.
 */
export function MeetingMiniBar() {
  const t = useTranslations("meetings");
  const session = useOptionalMeetingSession();
  const pathname = usePathname();
  const live = session?.live, target = session?.target;
  const visible = !!live && !!target && isInCallPhase(live.phase) && pathname !== target.roomHref;
  const bar = useRef<HTMLElement>(null);
  const viewport = useVisualViewport(visible);
  // The keyboard covers the bottom of the page without resizing it: its height is what the visual viewport lost.
  const keyboardLift = viewport.keyboard && viewport.height ? Math.max(0, window.innerHeight - viewport.top - viewport.height) : 0;
  const drag = useDraggable(bar, visible);
  useBottomClearance(bar, keyboardLift, visible && !drag.position);
  const compact = viewport.keyboard;
  if (!visible || !live || !target) return null;
  const room = live.room, local = room?.localParticipant;
  const connected = live.phase === "connected";
  const mic = Boolean(local?.isMicrophoneEnabled), camera = Boolean(local?.isCameraEnabled), sharing = Boolean(local?.isScreenShareEnabled);
  const people = room ? 1 + room.remoteParticipants.size : 0;
  async function toggle(kind: "mic" | "camera") {
    const failure = await live!.toggleMedia(kind);
    if (failure) toast.error(t(deviceErrorKey(failure)));
  }
  return <section ref={bar} aria-label={t("miniLabel")} data-meeting-mini data-dragged={drag.position ? "" : undefined}
    style={drag.position ? { left: drag.position.x, top: drag.position.y, right: "auto", bottom: "auto", width: "min(21rem, calc(100vw - 1rem))" } : undefined}
    className={cn("fixed z-30 overflow-hidden rounded-xl border bg-card shadow-lg",
      !drag.position && "left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:right-auto sm:w-[26rem] sm:max-w-[calc(100vw-1.5rem)] sm:left-[max(1rem,env(safe-area-inset-left))] lg:left-[calc(var(--workspace-sidebar-width)+1rem)] [body:has([data-sticky-actions])_&]:bottom-[4.75rem]")}>
    {/* The handle: picture + title. Pointer and touch drag from here; focus it for arrow-key moves (Shift: bigger steps, Home: back to the default place). */}
    <div role="group" tabIndex={0} aria-roledescription={t("miniDraggable")} aria-label={`${live.meeting?.title ?? t("group")}. ${t("miniMoveHint")}`} data-mini-handle
      {...drag.handlers}
      className={cn("relative touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", drag.dragging ? "cursor-grabbing" : "cursor-grab", compact ? "sr-only" : "block")}>
      <div className="h-24 sm:h-28 compact:h-16"><MiniFeed live={live} /></div>
      <div className="flex items-center gap-2 px-3 py-2">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", connected ? "bg-live" : "animate-pulse bg-warning")} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{live.meeting?.title ?? t("group")}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><span role="status" className="truncate">{connected ? t("miniActive") : t(`phase.${live.phase}`)}</span>{people > 0 && <span className="shrink-0">· {t("miniParticipants", { count: people })}</span>}</p>
          {sharing && <p className="flex items-center gap-1 text-xs text-live"><MonitorUp size={12} aria-hidden="true" />{t("screenSharing")}</p>}
        </div>
        <GripHorizontal size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </div>
    </div>
    <div className="flex items-center gap-1.5 border-t p-2">
      <Button variant={mic ? "secondary" : "outline"} className="size-11 shrink-0" aria-label={t(mic ? "micOff" : "micOn")} aria-pressed={mic} disabled={!connected || live.mediaBusy} onClick={() => void toggle("mic")}>
        {live.mediaBusy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : mic ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}
      </Button>
      <Button variant={camera ? "secondary" : "outline"} className="size-11 shrink-0" aria-label={t(camera ? "cameraOff" : "cameraOn")} aria-pressed={camera} disabled={!connected || live.mediaBusy} onClick={() => void toggle("camera")}>
        {camera ? <Camera size={18} aria-hidden="true" /> : <CameraOff size={18} aria-hidden="true" />}
      </Button>
      <Link href={target.roomHref} aria-label={t("returnToMeeting")} className={buttonVariants({ variant: "accent", className: "h-11 min-w-0 flex-1 shrink gap-2 px-3 max-[27rem]:flex-none max-[27rem]:w-11 max-[27rem]:px-0" })}><Video size={18} aria-hidden="true" /><span className="truncate max-[27rem]:sr-only">{t("returnToMeeting")}</span></Link>
      <ConfirmDialog
        trigger={<Button variant="destructive" className="size-11 shrink-0" aria-label={t("leave")}><PhoneOff size={18} aria-hidden="true" /></Button>}
        title={t("leaveTitle")} description={t("leaveDescription")} confirmLabel={t("leaveConfirm")} cancelLabel={t("leaveCancel")} destructive
        onConfirm={async () => { live.leave(); }} />
    </div>
  </section>;
}
