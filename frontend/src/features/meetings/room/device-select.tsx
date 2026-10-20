"use client";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Kind = "audioinput" | "videoinput" | "audiooutput";
/** The empty choice means the browser default device: no constraint is sent and the browser picks. */
const DEFAULT_CHOICE = "__default";

/**
 * The devices of one kind, without the browser's own "default" entry (the first option already is the default, so it
 * would appear twice). "Communications" and every real device keep their exact deviceId.
 */
export function deviceChoices(devices: MediaDeviceInfo[], kind: Kind) {
  return devices.filter(device => device.kind === kind && device.deviceId && device.deviceId !== "default");
}

/**
 * Device picker built on the shared Select of the app (same panel, focus ring, check mark and theming as every other
 * dropdown) instead of the native browser menu. `value` is a real deviceId, or "" for the default device; a value that
 * is no longer in the list (device unplugged) is shown as the default.
 */
export function DeviceSelect({ kind, devices, value, onChange, testId }: { kind: Kind; devices: MediaDeviceInfo[]; value: string; onChange: (deviceId: string) => void; testId?: string }) {
  const t = useTranslations("meetings");
  const choices = deviceChoices(devices, kind);
  const items = [{ value: DEFAULT_CHOICE, label: t("defaultDevice") }, ...choices.map((device, index) => ({ value: device.deviceId, label: device.label || `${t(kind)} ${index + 1}` }))];
  const current = choices.some(device => device.deviceId === value) ? value : DEFAULT_CHOICE;
  return <div className="space-y-1 text-xs text-muted-foreground">
    <span aria-hidden="true">{t(kind)}</span>
    <Select value={current} items={items} modal={false} onValueChange={next => { if (typeof next === "string") onChange(next === DEFAULT_CHOICE ? "" : next); }}>
      <SelectTrigger aria-label={t(kind)} data-testid={testId} className="h-11 w-full min-w-0 text-foreground data-[size=default]:h-11 compact:text-base">
        <SelectValue className="min-w-0 truncate" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="max-h-[min(18rem,var(--available-height))] p-1" listProps={{ "aria-label": t(kind) }}>
        {items.map(item => <SelectItem key={item.value} value={item.value} wrap className="min-h-11" data-device-id={item.value === DEFAULT_CHOICE ? "" : item.value}>{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
