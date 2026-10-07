"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_ROLES, type ProjectRole } from "@/features/projects/types";
import { ProjectRoleLabel } from "@/features/projects/role-presentation";

export const INVITATION_MESSAGE_MAX = 100;

/** Roles the invitee receives on accepting; at least one is required by the server. */
export function RolePicker({ value, onChange }: { value: ProjectRole[]; onChange: (roles: ProjectRole[]) => void }) {
  const t = useTranslations("invitations");
  const ids = useId();

  function toggle(role: ProjectRole, checked: boolean) {
    onChange(checked ? [...value, role] : value.filter((item) => item !== role));
  }

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium leading-none">{t("rolesLabel")}</legend>
      <div className="grid grid-cols-1 gap-2 pt-1.5 sm:grid-cols-2">
        {PROJECT_ROLES.map((role) => (
          <label key={role} htmlFor={`${ids}-${role}`} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
            <Checkbox id={`${ids}-${role}`} checked={value.includes(role)} onCheckedChange={(checked) => toggle(role, checked === true)} />
            <ProjectRoleLabel role={role} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function MessageField({ value, onChange }: { value: string; onChange: (message: string) => void }) {
  const t = useTranslations("invitations");
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t("message")}</Label>
      <Textarea id={id} rows={3} maxLength={INVITATION_MESSAGE_MAX} value={value} onChange={(event) => onChange(event.target.value)} />
      <p className="text-right text-xs text-muted-foreground">
        {value.length} / {INVITATION_MESSAGE_MAX}
      </p>
    </div>
  );
}
