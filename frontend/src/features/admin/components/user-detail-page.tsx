"use client";

import { useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/hooks/use-session";
import Link from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { adminApi, type AccountStatus, type AdminSession, type AdminUserDetail } from "../api";
import { summarizeUserAgent } from "../lib/user-agent";
import { adminKeys } from "../query-keys";
import { ErrorPanel, Field, Section, ToneBadge, useAdminDates, type Tone } from "./admin-ui";

const STATUS_TONE: Record<AccountStatus, Tone> = { ACTIVE: "success", DISABLED: "danger", PENDING_VERIFICATION: "warning" };

/**
 * One account in detail: profile, what its role grants (read only: there is a single administrator and no role
 * management), linked sign-in providers and the open sessions, each of which an administrator can end. Everything the
 * server sends is shown as text.
 */
export function AdminUserDetailPage({ userId }: { userId: string }) {
  const t = useTranslations("admin.userDetail");
  const tu = useTranslations("admin.users");
  const ta = useTranslations("admin");
  const te = useTranslations("errors");
  const ids = useId();
  const queryClient = useQueryClient();
  const { data: me } = useSession();
  const actorId = me?.id;
  const dates = useAdminDates();

  const detail = useQuery({
    queryKey: adminKeys.user(actorId, userId),
    queryFn: ({ signal }) => adminApi.user(userId, signal),
    enabled: !!actorId,
  });
  const sessions = useQuery({
    queryKey: adminKeys.userSessions(actorId, userId),
    queryFn: ({ signal }) => adminApi.sessions(userId, signal),
    enabled: !!actorId && detail.isSuccess,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.user(actorId, userId) });
  const failed = (error: unknown) => {
    toast.error(te(errorKey(error)));
    throw error;
  };
  const revokeOne = useMutation({
    mutationFn: (session: AdminSession) => adminApi.revokeSession(userId, session.id),
    onSuccess: async () => {
      await refresh();
      toast.success(t("sessions.revokeDone"));
    },
    onError: async (error) => {
      // The session may already be gone (it ended or was revoked meanwhile): show the current list.
      if (error instanceof ApiError && error.status === 404) await refresh();
    },
  });
  const revokeAll = useMutation({
    mutationFn: () => adminApi.revokeAllSessions(userId),
    onSuccess: async (result) => {
      await refresh();
      toast.success(t("sessions.revokeAllDone", { count: result?.revoked ?? 0 }));
    },
  });

  const crumbs = [{ label: ta("nav.users"), href: "/admin/users" }, { label: detail.data?.user.nickname ?? t("breadcrumbFallback") }];

  if (detail.isError) {
    const gone = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <section aria-label={t("title")}>
        <Breadcrumb label={t("breadcrumb")} items={crumbs} className="mb-4" />
        {gone ? (
          <EmptyState
            title={t("notFound.title")}
            description={t("notFound.description")}
            action={<Link href="/admin/users" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{t("backToUsers")}</Link>}
          />
        ) : (
          <ErrorPanel message={t("error")} retryLabel={tu("retry")} onRetry={() => void detail.refetch()} />
        )}
      </section>
    );
  }

  if (!detail.data) {
    return (
      <section aria-label={t("title")}>
        <Breadcrumb label={t("breadcrumb")} items={crumbs} className="mb-4" />
        <div role="status" aria-label={t("loading")} className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
          <Skeleton className="h-40 w-full" />
        </div>
      </section>
    );
  }

  const { user, linkedProviders, platformPermissions }: AdminUserDetail = detail.data;
  const self = user.id === actorId;
  const list = sessions.data ?? [];

  function deviceOf(session: AdminSession) {
    const { browser, os } = summarizeUserAgent(session.userAgent);
    const text = [browser, os].filter(Boolean).join(" · ");
    return text || t("sessions.unknownDevice");
  }

  function revokeButton(session: AdminSession) {
    return (
      <ConfirmDialog
        destructive
        trigger={<Button variant="destructive" size="sm" className="min-h-11 sm:min-h-9">{t("sessions.revoke")}</Button>}
        title={t("sessions.revokeTitle", { device: deviceOf(session) })}
        description={t(self ? "sessions.revokeDescriptionSelf" : "sessions.revokeDescription", { name: user.nickname })}
        confirmLabel={t("sessions.revokeConfirm")}
        cancelLabel={t("sessions.cancel")}
        onConfirm={() => revokeOne.mutateAsync(session).catch(failed)}
        formatError={(error) => (error instanceof ApiError && error.status === 404 ? t("sessions.gone") : te(errorKey(error)))}
      />
    );
  }

  return (
    <section aria-label={t("title")}>
      <Breadcrumb label={t("breadcrumb")} items={crumbs} className="mb-4" />
      <PageHeader
        title={user.nickname}
        description={t("description")}
        titleAdornment={<ToneBadge tone={STATUS_TONE[user.accountStatus]}>{tu(`statuses.${user.accountStatus}`)}</ToneBadge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby={`${ids}-profile`} className="rounded-2xl border bg-card p-5">
          <h2 id={`${ids}-profile`} className="mb-4 text-lg font-semibold">{t("profile.title")}</h2>
          <dl className="grid gap-4 sm:grid-cols-2" data-testid="user-profile">
            <Field label={t("profile.nickname")}>
              {user.nickname}
              {self && <ToneBadge tone="info" className="ml-2">{tu("you")}</ToneBadge>}
            </Field>
            <Field label={t("profile.email")}><span className="break-all">{user.email}</span></Field>
            <Field label={t("profile.status")}>{tu(`statuses.${user.accountStatus}`)}</Field>
            <Field label={t("profile.verification")}>
              {user.emailVerificationStatus === "VERIFIED" ? t("profile.verified") : t("profile.unverified")}
            </Field>
            <Field label={t("profile.created")}>{dates.dateTime(user.createdAt)}</Field>
            <Field label={t("profile.mustChangePassword")}>{user.mustChangePassword ? t("profile.yes") : t("profile.no")}</Field>
            <Field label={t("profile.providers")} className="sm:col-span-2">
              {linkedProviders.length === 0 ? (
                <span className="font-normal text-muted-foreground">{t("profile.noProviders")}</span>
              ) : (
                <ul className="flex flex-wrap gap-2" aria-label={t("profile.providers")}>
                  {linkedProviders.map((provider) => <li key={provider}><ToneBadge tone="neutral">{t(`providers.${provider}`)}</ToneBadge></li>)}
                </ul>
              )}
            </Field>
          </dl>
        </section>

        <section aria-labelledby={`${ids}-access`} className="rounded-2xl border bg-card p-5">
          <h2 id={`${ids}-access`} className="mb-4 text-lg font-semibold">{t("access.title")}</h2>
          <dl className="space-y-4">
            <Field label={t("access.role")}><ToneBadge tone={user.globalRole === "ADMIN" ? "info" : "neutral"}>{tu(`roles.${user.globalRole}`)}</ToneBadge></Field>
            <Field label={t("access.permissions")}>
              {platformPermissions.length === 0 ? (
                <span className="font-normal text-muted-foreground">{t("access.noPermissions")}</span>
              ) : (
                <ul className="space-y-1.5 font-normal" data-testid="user-permissions">
                  {platformPermissions.map((permission) => (
                    <li key={permission} className="flex items-baseline gap-2" data-permission={permission}>
                      <span aria-hidden="true" className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{t(`permissions.${permission}`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </dl>
          <p className="mt-5 rounded-lg bg-muted px-3 py-2.5 text-sm leading-6 text-muted-foreground" data-testid="single-admin-note">{t("access.singleAdminNote")}</p>
        </section>
      </div>

      <Section
        id={`${ids}-sessions`}
        title={t("sessions.title")}
        description={t("sessions.description")}
        action={list.length > 0 && (
          <ConfirmDialog
            destructive
            trigger={<Button variant="destructive" className="min-h-11">{t("sessions.revokeAll")}</Button>}
            title={t("sessions.revokeAllTitle", { name: user.nickname })}
            description={t(self ? "sessions.revokeAllDescriptionSelf" : "sessions.revokeAllDescription", { name: user.nickname, count: list.length })}
            confirmLabel={t("sessions.revokeAllConfirm")}
            cancelLabel={t("sessions.cancel")}
            onConfirm={() => revokeAll.mutateAsync().then(() => undefined).catch(failed)}
            formatError={(error) => te(errorKey(error))}
          />
        )}
      >
        {sessions.isError ? (
          <ErrorPanel message={t("sessions.error")} retryLabel={tu("retry")} onRetry={() => void sessions.refetch()} />
        ) : !sessions.data ? (
          <div role="status" aria-label={t("sessions.loading")} className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
          </div>
        ) : list.length === 0 ? (
          <EmptyState title={t("sessions.empty.title")} description={t(user.accountStatus === "DISABLED" ? "sessions.empty.disabled" : "sessions.empty.description")} />
        ) : (
          <>
            <div className="hidden md:block">
              <Table aria-label={t("sessions.tableLabel")}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t("sessions.columns.device")}</TableHead>
                    <TableHead scope="col">{t("sessions.columns.created")}</TableHead>
                    <TableHead scope="col">{t("sessions.columns.lastUsed")}</TableHead>
                    <TableHead scope="col">{t("sessions.columns.expires")}</TableHead>
                    <TableHead scope="col"><span className="sr-only">{tu("columns.actions")}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((session) => (
                    <TableRow key={session.id} data-session-row>
                      <TableCell className="max-w-64 truncate font-medium" title={session.userAgent ?? undefined}>{deviceOf(session)}</TableCell>
                      <TableCell>{dates.dateTime(session.createdAt)}</TableCell>
                      <TableCell title={session.lastUsedAt ? dates.dateTime(session.lastUsedAt) : undefined}>
                        {session.lastUsedAt ? dates.relative(session.lastUsedAt) : t("sessions.neverUsed")}
                      </TableCell>
                      <TableCell>{dates.dateTime(session.expiresAt)}</TableCell>
                      <TableCell className="text-right">{revokeButton(session)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-border rounded-2xl border bg-card md:hidden" aria-label={t("sessions.tableLabel")}>
              {list.map((session) => (
                <li key={session.id} data-session-row className="space-y-2 p-4">
                  <p className="font-medium break-words">{deviceOf(session)}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">{t("sessions.columns.created")}</dt>
                    <dd>{dates.dateTime(session.createdAt)}</dd>
                    <dt className="text-muted-foreground">{t("sessions.columns.lastUsed")}</dt>
                    <dd>{session.lastUsedAt ? dates.relative(session.lastUsedAt) : t("sessions.neverUsed")}</dd>
                    <dt className="text-muted-foreground">{t("sessions.columns.expires")}</dt>
                    <dd>{dates.dateTime(session.expiresAt)}</dd>
                  </dl>
                  <div>{revokeButton(session)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </section>
  );
}
