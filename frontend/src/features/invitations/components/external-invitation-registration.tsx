"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { AuthCard, authCtaClass } from "@/features/auth/components/auth-card";
import { FormField } from "@/components/common/form-field";
import { SubmitButton } from "@/components/common/submit-button";
import { authApi } from "@/features/auth/api";
import { registerSchema } from "@/features/auth/schemas";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import { errorKey } from "@/lib/api/error-message";
import { invitationsApi } from "../api";
import type { ExternalInvitationPreview } from "../types";
import { useInvitationToken } from "../hooks/use-invitation-token";

export function ExternalInvitationRegistration() {
  const t = useTranslations("invitations");
  const tr = useTranslations("roles");
  const ta = useTranslations("register");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useInvitationToken();
  const [preview, setPreview] = useState<ExternalInvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) return;
    Promise.all([invitationsApi.previewExternal(token), authApi.me().catch(() => null)])
      .then(([invitation, me]) => { setPreview(invitation); setSignedIn(!!me); })
      .catch(() => setError(t("externalExpired")))
      .finally(() => setLoading(false));
  }, [t, token]);

  async function acceptExisting() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const accepted = await invitationsApi.acceptExternal(token);
      router.replace(`/projects/${accepted.projectSlug}`);
    } catch (cause) { setError(te(errorKey(cause))); setBusy(false); }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !preview) return;
    const values = { email: preview.email, nickname, password, confirmPassword };
    const validation = registerSchema.safeParse(values);
    if (!validation.success) {
      setError(tv(validation.error.issues[0].message));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const accepted = await authApi.registerInvitation({ token, email: preview.email,
        firstName: preview.firstName, lastName: preview.lastName, nickname, password, confirmPassword });
      await authApi.login({ email: preview.email, password });
      const me = await authApi.me();
      queryClient.setQueryData(sessionQueryKey, me);
      router.replace(`/projects/${accepted.projectSlug}`);
    } catch (cause) { setError(te(errorKey(cause))); setBusy(false); }
  }

  return <AuthCard title={t("externalTitle")} subtitle={preview
    ? t("externalDescription", { inviter: preview.inviterName, project: preview.projectName }) : ""}>
    {loading ? <p className="text-sm text-muted-foreground">…</p> : !preview
      ? <p role="alert" className="text-sm text-destructive">{error ?? t("externalExpired")}</p>
      : <div className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
            <p>{preview.firstName} {preview.lastName} · {preview.email}</p>
            <p>{preview.roles.map((role) => tr(role)).join(", ")}</p>
            {preview.message && <p className="text-muted-foreground">{preview.message}</p>}
          </div>
          {signedIn ? <button type="button" disabled={busy} onClick={acceptExisting} className={authCtaClass + " w-full"}>{t("externalAccept")}</button>
            : <><form onSubmit={register} className="space-y-4">
                <FormField label={ta("nickname")} value={nickname} onChange={(event) => setNickname(event.target.value)} autoComplete="username" />
                <FormField label={ta("password")} value={password} onChange={(event) => setPassword(event.target.value)} password autoComplete="new-password" />
                <FormField label={ta("confirmPassword")} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} password autoComplete="new-password" />
                <SubmitButton pending={busy} className={authCtaClass}>{t("externalJoin")}</SubmitButton>
              </form>
              <p className="text-sm text-muted-foreground">{t("externalAlreadyRegistered")} <Link href={`/login#invitation=${encodeURIComponent(token!)}`} className="underline">{ta("toLogin")}</Link></p>
            </>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>}
  </AuthCard>;
}
