"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
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
import { clearPrivateInvitations } from "../query-keys";
import { clearPrivateNotifications } from "@/features/notifications/query-keys";
import { clearPrivateTeams } from "@/features/squads/cache";
import { clearPrivateAdmin } from "@/features/admin/query-keys";
import {isInvalidInvitationToken,isPreviewServerFailure} from "../external-preview-error";

export function ExternalInvitationRegistration() {
  const t = useTranslations("invitations");
  const tr = useTranslations("roles");
  const ta = useTranslations("register");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useInvitationToken();
  const [previewState,setPreviewState]=useState<{token:string;attempt:number;preview:ExternalInvitationPreview|null;signedIn:boolean;failure:unknown}|null>(null);
  const [previewAttempt,setPreviewAttempt]=useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const invalidToken=!token?.trim() || token.length>200;
  const current=previewState?.token===token&&previewState.attempt===previewAttempt?previewState:null;
  const preview=current?.preview??null,signedIn=current?.signedIn??false;
  const loading=!invalidToken&&!current;
  const expired=invalidToken||isInvalidInvitationToken(current?.failure);
  const previewError=expired?t("externalExpired"):isPreviewServerFailure(current?.failure)?t("externalUnavailable"):te(errorKey(current?.failure));
  const retryable=!!current?.failure&&!expired;

  useEffect(() => {
    if (!token || invalidToken) return;
    const controller=new AbortController();let cancelled=false;
    Promise.all([invitationsApi.previewExternal(token,controller.signal), authApi.me().catch(() => null)])
      .then(([invitation, me]) => { if(!cancelled){setPreviewState({token,attempt:previewAttempt,preview:invitation,signedIn:!!me,failure:null});setError(null);} })
      .catch(cause => {if(!cancelled)setPreviewState({token,attempt:previewAttempt,preview:null,signedIn:false,failure:cause});});
    return()=>{cancelled=true;controller.abort();};
  }, [token,invalidToken,previewAttempt]);

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
      clearPrivateInvitations(queryClient);
      clearPrivateNotifications(queryClient);
      clearPrivateTeams(queryClient);
      clearPrivateAdmin(queryClient);
      queryClient.setQueryData(sessionQueryKey, me);
      router.replace(`/projects/${accepted.projectSlug}`);
    } catch (cause) { setError(te(errorKey(cause))); setBusy(false); }
  }

  return <AuthCard title={t("externalTitle")} subtitle={preview
    ? t("externalDescription", { inviter: preview.inviterName, project: preview.projectName }) : ""}>
    {loading ? <p role="status" className="text-sm text-muted-foreground">…</p> : !preview
      ? <div className="space-y-4"><p role="alert" className="text-sm text-destructive">{previewError}</p>
          {retryable&&<button type="button" className={authCtaClass+" w-full"} onClick={()=>{setError(null);setPreviewAttempt(value=>value+1);}}>{t("retry")}</button>}
        </div>
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
