"use client";
import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Camera, CameraOff, Loader2, Mic, MicOff, MessageSquare, MonitorUp, MonitorX, MoreHorizontal, PhoneOff, Settings2, Users } from "lucide-react";
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
  pressed?: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** Looks inactive but stays clickable, so a tap can explain why the feature is missing. */
  unavailable?: boolean;
  badge?: number;
  /** Extra spoken context (e.g. unread count) that must not change the button's name. */
  description?: string;
  className?: string;
};

function Control({ label, icon, onClick, pressed, disabled, busy, unavailable, badge = 0, description, className }: ControlProps) {
  const descriptionId = useId();
  return <Tooltip>
    <TooltipTrigger render={<Button
      variant={pressed ? "secondary" : "outline"}
      className={cn("relative min-h-11 min-w-11 compact:min-w-0 compact:flex-1 compact:basis-0", unavailable && "opacity-60", className)}
      aria-label={label} aria-describedby={description ? descriptionId : undefined} aria-pressed={pressed} aria-busy={busy || undefined}
      disabled={disabled} onClick={onClick}
    >
      {busy ? <Loader2 size={19} className="animate-spin" aria-hidden="true" /> : icon}
      {badge > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">{badge > 9 ? "9+" : badge}</span>}
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
  onMic: () => void;
  onCamera: () => void;
  onScreen: () => void;
  onPanel: (panel: RoomPanel) => void;
  onEndForAll: () => void;
  onLeave: () => Promise<void>;
};

/**
 * The call bar. On wide screens it keeps every control in one row; on phones (the `compact` variant) it shrinks to the
 * six everyday controls with equal, thumb-sized targets, participants move to the top bar and the rest into "More".
 * "Leave" always asks first and is visually apart; "End for everyone" is a separate manager-only action.
 */
export function RoomControls(props: ControlsProps) {
  const t = useTranslations("meetings");
  const { active, mediaBusy, panel, sharing, screenSupported } = props;
  const screenLabel = !screenSupported ? t("screenShareUnavailable") : sharing ? t("screenShareStop") : t("screen");
  return <footer
    aria-label={t("controls")}
    className={cn("z-10 flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-card p-3 shadow-lg sticky bottom-3 compact:static compact:min-h-[var(--room-bar)] compact:flex-nowrap compact:gap-1 compact:rounded-none compact:border-x-0 compact:border-b-0 compact:px-2 compact:py-2 compact:pb-[max(0.5rem,env(safe-area-inset-bottom))] compact:shadow-none", props.keyboard && "compact:hidden")}
  >
    <Control label={t(props.mic ? "micOff" : "micOn")} icon={props.mic ? <Mic size={19} /> : <MicOff size={19} />} pressed={props.mic} disabled={!active || mediaBusy} onClick={props.onMic} />
    <Control label={t(props.camera ? "cameraOff" : "cameraOn")} icon={props.camera ? <Camera size={19} /> : <CameraOff size={19} />} pressed={props.camera} disabled={!active || mediaBusy} onClick={props.onCamera} />
    <Control label={screenLabel} icon={sharing ? <MonitorX size={19} /> : <MonitorUp size={19} />} pressed={sharing} busy={props.screenBusy} unavailable={!screenSupported} disabled={!active} onClick={props.onScreen} />
    <Control label={t("participants")} icon={<Users size={19} />} pressed={panel === "participants"} disabled={!active || mediaBusy} onClick={() => props.onPanel("participants")} className="compact:hidden" />
    <Control label={t("chat")} description={props.unread > 0 ? t("unreadMessages", { count: props.unread }) : undefined} icon={<MessageSquare size={19} />} pressed={panel === "chat"} badge={props.unread} disabled={!active || mediaBusy} onClick={() => props.onPanel("chat")} />
    <Button variant={panel === "devices" ? "secondary" : "outline"} className="min-h-11 compact:hidden" disabled={!active} onClick={() => props.onPanel("devices")}>{t("devices")}</Button>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="hidden min-h-11 min-w-0 flex-1 basis-0 compact:inline-flex" aria-label={t("more")} disabled={!active} />}><MoreHorizontal size={19} aria-hidden="true" /></DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-52">
        <DropdownMenuItem className="min-h-11" onClick={() => props.onPanel("devices")}><Settings2 aria-hidden="true" />{t("devices")}</DropdownMenuItem>
        {props.canEndForAll && <DropdownMenuItem className="min-h-11" variant="destructive" onClick={props.onEndForAll}><PhoneOff aria-hidden="true" />{t("endForAll")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmDialog
      trigger={<Button variant="destructive" className="min-h-11 compact:ml-1 compact:min-w-0 compact:flex-1 compact:basis-0" aria-label={t("leave")}><PhoneOff size={18} aria-hidden="true" /><span className="compact:hidden">{t("leave")}</span></Button>}
      title={t("leaveTitle")} description={t("leaveDescription")} confirmLabel={t("leaveConfirm")} cancelLabel={t("leaveCancel")} destructive
      onConfirm={props.onLeave}
    />
    {props.canEndForAll && <Button variant="ghost" className="min-h-11 text-destructive compact:hidden" onClick={props.onEndForAll}>{t("endForAll")}</Button>}
  </footer>;
}
