"use client";
import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Camera, CameraOff, LayoutGrid, Loader2, Mic, MicOff, MessageSquare, MonitorUp, MonitorX, MoreHorizontal, PhoneOff, Presentation, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type RoomPanel = "participants" | "chat" | "devices";

type ControlProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Selected / switched on: the blue state. */
  pressed?: boolean;
  /** The hardware is switched off (mic, camera): a warning tint plus a crossed icon, so the state never rests on colour alone. */
  off?: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** Looks inactive but stays clickable, so a tap can explain why the feature is missing. */
  unavailable?: boolean;
  badge?: number;
  /** Extra spoken context (e.g. unread count) that must not change the button's name. */
  description?: string;
  className?: string;
};

function Control({ label, icon, onClick, pressed, off, disabled, busy, unavailable, badge = 0, description, className }: ControlProps) {
  const descriptionId = useId();
  return <Tooltip>
    <TooltipTrigger render={<Button
      variant="ghost"
      className={cn("relative size-11 shrink-0 rounded-xl bg-muted text-foreground hover:bg-muted/70 compact:size-auto compact:min-h-11 compact:min-w-0 compact:flex-1 compact:basis-0",
        pressed && "bg-meeting text-meeting-foreground hover:bg-meeting-hover hover:text-meeting-foreground",
        off && "bg-destructive/15 text-destructive hover:bg-destructive/25 hover:text-destructive", unavailable && "opacity-60", className)}
      aria-label={label} aria-describedby={description ? descriptionId : undefined} aria-pressed={pressed} aria-busy={busy || undefined}
      disabled={disabled} onClick={onClick}
    >
      {busy ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : icon}
      {badge > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-meeting px-1 text-[10px] font-semibold leading-none text-meeting-foreground">{badge > 9 ? "9+" : badge}</span>}
      {description && <span id={descriptionId} className="sr-only">{description}</span>}
    </Button>} />
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>;
}

type ControlsProps = {
  active: boolean;
  mediaBusy: boolean;
  mic: boolean;
  camera: boolean;
  sharing: boolean;
  screenBusy: boolean;
  screenSupported: boolean;
  panel: RoomPanel | null;
  unread: number;
  /** The on-screen keyboard is open: the bar steps aside so the chat input keeps the room. */
  keyboard: boolean;
  canEndForAll: boolean;
  /** Stage layout (focus / grid); a menu entry switches it. */
  grid: boolean;
  onGrid: () => void;
  onMic: () => void;
  onCamera: () => void;
  onScreen: () => void;
  onPanel: (panel: RoomPanel) => void;
  onEndForAll: () => void;
  onLeave: () => Promise<void>;
};

/**
 * The call bar: a floating rounded bar in the middle of the bottom edge. On wide screens it keeps every control in one row; on
 * phones (the `compact` variant) it shrinks to the six everyday controls with equal, thumb-sized targets, participants move
 * to the top bar and the rest into "More". "Leave" always asks first and is visually apart; "End for everyone" is a separate
 * manager-only action.
 */
export function RoomControls(props: ControlsProps) {
  const t = useTranslations("meetings");
  const { active, mediaBusy, panel, sharing, screenSupported } = props;
  const screenLabel = !screenSupported ? t("screenShareUnavailable") : sharing ? t("screenShareStop") : t("screen");
  return <footer
    aria-label={t("controls")} data-room-controls
    className={cn("sticky bottom-3 z-10 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border bg-card p-2 shadow-lg compact:static compact:mx-0 compact:min-h-(--room-bar) compact:w-full compact:flex-nowrap compact:gap-1 compact:rounded-none compact:border-x-0 compact:border-b-0 compact:px-2 compact:py-2 compact:pb-[max(0.5rem,env(safe-area-inset-bottom))] compact:shadow-none", props.keyboard && "compact:hidden")}
  >
    <Control label={t(props.mic ? "micOff" : "micOn")} icon={props.mic ? <Mic size={20} /> : <MicOff size={20} />} pressed={props.mic} off={!props.mic} disabled={!active || mediaBusy} onClick={props.onMic} />
    <Control label={t(props.camera ? "cameraOff" : "cameraOn")} icon={props.camera ? <Camera size={20} /> : <CameraOff size={20} />} pressed={props.camera} off={!props.camera} disabled={!active || mediaBusy} onClick={props.onCamera} />
    <Control label={screenLabel} icon={sharing ? <MonitorX size={20} /> : <MonitorUp size={20} />} pressed={sharing} busy={props.screenBusy} unavailable={!screenSupported} disabled={!active} onClick={props.onScreen} />
    <span aria-hidden="true" className="mx-1 h-6 w-px bg-border compact:hidden" />
    <Control label={t("participants")} icon={<Users size={20} />} pressed={panel === "participants"} disabled={!active || mediaBusy} onClick={() => props.onPanel("participants")} className="compact:hidden" />
    <Control label={t("chat")} description={props.unread > 0 ? t("unreadMessages", { count: props.unread }) : undefined} icon={<MessageSquare size={20} />} pressed={panel === "chat"} badge={props.unread} disabled={!active || mediaBusy} onClick={() => props.onPanel("chat")} />
    <Control label={t("devices")} icon={<Settings2 size={20} />} pressed={panel === "devices"} disabled={!active} onClick={() => props.onPanel("devices")} className="compact:hidden" />
    <DropdownMenu>
      <Tooltip><TooltipTrigger render={<DropdownMenuTrigger render={<Button variant="ghost" className="size-11 shrink-0 rounded-xl bg-muted compact:size-auto compact:min-h-11 compact:min-w-0 compact:flex-1 compact:basis-0" aria-label={t("more")} disabled={!active} />}><MoreHorizontal size={20} aria-hidden="true" /></DropdownMenuTrigger>} /><TooltipContent>{t("more")}</TooltipContent></Tooltip>
      <DropdownMenuContent side="top" align="end" className="min-w-56">
        <DropdownMenuItem className="min-h-11 hidden compact:flex" onClick={() => props.onPanel("devices")}><Settings2 aria-hidden="true" />{t("devices")}</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 compact:hidden" onClick={props.onGrid}>{props.grid ? <Presentation aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}{t(props.grid ? "focusView" : "gridView")}</DropdownMenuItem>
        {props.canEndForAll && <DropdownMenuItem className="min-h-11 hidden compact:flex" variant="destructive" onClick={props.onEndForAll}><PhoneOff aria-hidden="true" />{t("endForAll")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmDialog
      trigger={<Button variant="destructive" className="size-11 shrink-0 rounded-xl bg-destructive text-background hover:bg-destructive/85 compact:ml-1 compact:size-auto compact:min-h-11 compact:min-w-0 compact:flex-1 compact:basis-0" aria-label={t("leave")}><PhoneOff size={20} aria-hidden="true" /></Button>}
      title={t("leaveTitle")} description={t("leaveDescription")} confirmLabel={t("leaveConfirm")} cancelLabel={t("leaveCancel")} destructive
      onConfirm={props.onLeave}
    />
  </footer>;
}
