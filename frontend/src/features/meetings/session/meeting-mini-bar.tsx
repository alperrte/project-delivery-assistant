"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, CameraOff, Loader2, Mic, MicOff, MonitorUp, PhoneOff, Video } from "lucide-react";
import Link, { usePathname } from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "../room/use-visual-viewport";
import { deviceErrorKey, isInCallPhase, useOptionalMeetingSession } from "./meeting-session";

const GAP = 8;

/**
 * Keeps the bar clear of the other fixed things at the bottom of the screen, measured from where they really are:
 * the chat dock (title bar or compact window) when it overlaps the bar horizontally, and the on-screen keyboard, which
 * covers the bottom of the page without resizing it. The bar sits above them (never under, never over). It also
 * publishes how much room it takes, so the chat can leave it free: `--meeting-mini-height` (its own height) shrinks the
 * compact chat window, `--meeting-mini-reserve` (distance from the screen bottom to its top) lifts the full chat panel.
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
    };
  }, [ref, keyboardLift, visible]);
}

/**
 * The call while another workspace page is open: what is running, one tap back to the room, the two everyday media
 * toggles and Leave (with the same confirmation as in the room). Hidden on the room page itself, which has the full bar.
 * Bottom-left on desktop (the chat dock lives bottom-right), full width on phones, lifted above sticky save bars and
 * above the chat dock; with the keyboard open it shrinks to the four controls and rides above the keyboard.
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
  useBottomClearance(bar, keyboardLift, visible);
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
  return <section ref={bar} aria-label={t("miniLabel")} data-meeting-mini
    className="fixed left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex items-center gap-1.5 rounded-xl border bg-card p-2 shadow-lg sm:right-auto sm:w-[26rem] sm:max-w-[calc(100vw-1.5rem)] sm:left-[max(1rem,env(safe-area-inset-left))] lg:left-[calc(var(--workspace-sidebar-width)+1rem)] [body:has([data-sticky-actions])_&]:bottom-[4.75rem]">
    <div className={cn("min-w-0 flex-1 px-1", compact && "sr-only")}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", connected ? "bg-live" : "animate-pulse bg-warning")} />
        <span className="truncate">{live.meeting?.title ?? t("group")}</span>
      </p>
      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><span role="status" className="truncate">{connected ? t("miniActive") : t(`phase.${live.phase}`)}</span>{people > 0 && <span className="shrink-0">· {t("miniParticipants", { count: people })}</span>}</p>
      {sharing && <p className="flex items-center gap-1 text-xs text-live"><MonitorUp size={12} aria-hidden="true" />{t("screenSharing")}</p>}
    </div>
    <Button variant={mic ? "secondary" : "outline"} className="size-11 shrink-0" aria-label={t(mic ? "micOff" : "micOn")} aria-pressed={mic} disabled={!connected || live.mediaBusy} onClick={() => void toggle("mic")}>
      {live.mediaBusy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : mic ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}
    </Button>
    <Button variant={camera ? "secondary" : "outline"} className="size-11 shrink-0" aria-label={t(camera ? "cameraOff" : "cameraOn")} aria-pressed={camera} disabled={!connected || live.mediaBusy} onClick={() => void toggle("camera")}>
      {camera ? <Camera size={18} aria-hidden="true" /> : <CameraOff size={18} aria-hidden="true" />}
    </Button>
    <Link href={target.roomHref} aria-label={t("returnToMeeting")} className={buttonVariants({ variant: "accent", className: "h-11 shrink-0 gap-2 px-3 max-[27rem]:w-11 max-[27rem]:px-0" })}><Video size={18} aria-hidden="true" /><span className="max-[27rem]:sr-only">{t("returnToMeeting")}</span></Link>
    <ConfirmDialog
      trigger={<Button variant="destructive" className="size-11 shrink-0" aria-label={t("leave")}><PhoneOff size={18} aria-hidden="true" /></Button>}
      title={t("leaveTitle")} description={t("leaveDescription")} confirmLabel={t("leaveConfirm")} cancelLabel={t("leaveCancel")} destructive
      onConfirm={async () => { live.leave(); }} />
  </section>;
}
