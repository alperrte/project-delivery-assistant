"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import type { AuthenticatedUser } from "@/features/auth/api";
import { sessionQueryKey } from "@/features/auth/hooks/use-session";
import { accountApi } from "../api";
import { nicknameIdentityQuery, normalizeNickname, validNickname } from "../nickname";

export function NicknameField({ user }: { user: AuthenticatedUser }) {
  const t = useTranslations("account.nicknameEdit");
  const client = useQueryClient(), id = useId();
  const [draft, setDraft] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const value = draft ?? user.nickname;
  const operation = useRef<AbortController | null>(null), active = useRef(true);
  const current = () => active.current && client.getQueryData<AuthenticatedUser>(sessionQueryKey)?.id === user.id;
  useEffect(() => {
    active.current = true;
    const stop = client.getQueryCache().subscribe(event => {
      if (event.query.queryKey[0] === sessionQueryKey[0] && client.getQueryData<AuthenticatedUser>(sessionQueryKey)?.id !== user.id) operation.current?.abort();
    });
    return () => { active.current = false; operation.current?.abort(); stop(); };
  }, [client, user.id]);
  const normalized = normalizeNickname(value), dirty = normalized !== user.nickname, valid = validNickname(value);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty || !valid || operation.current || !current()) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setError(null);
    try {
      const fresh = await accountApi.rename(normalized, controller.signal);
      if (!current() || controller.signal.aborted || fresh.id !== user.id) return;
      await client.cancelQueries({ queryKey: sessionQueryKey });
      if (!current() || controller.signal.aborted) return;
      client.setQueryData(sessionQueryKey, fresh); setDraft(null);
      await client.invalidateQueries({ predicate: query => nicknameIdentityQuery(query.queryKey, user.id) });
      if (current()) toast.success(t("saved"));
    } catch (failure) {
      if (current() && !controller.signal.aborted) setError(failure instanceof ApiError && failure.code === "NICKNAME_TAKEN" ? t("taken")
        : failure instanceof ApiError && failure.status === 400 ? t("invalid") : t("failed"));
    } finally { operation.current = null; if (current()) setBusy(false); }
  }
  const shownError = error ?? (dirty && !valid ? t("invalid") : null);
  return <form onSubmit={save} className="space-y-2">
    <Label htmlFor={id}>{t("label")}</Label>
    <Input id={id} name="nickname" autoComplete="nickname" value={value} disabled={busy}
      aria-invalid={!!shownError} aria-describedby={`${id}-hint${shownError ? ` ${id}-error` : ""}`}
      onChange={event => { setDraft(event.target.value); setError(null); }} />
    <p id={`${id}-hint`} className="text-xs text-muted-foreground">{t("hint")}</p>
    {shownError && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{shownError}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" className="min-h-11" disabled={!dirty || !valid || busy}>{busy ? t("saving") : t("save")}</Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={busy || draft === null} onClick={() => { setDraft(null); setError(null); }}>{t("cancel")}</Button>
    </div>
  </form>;
}
