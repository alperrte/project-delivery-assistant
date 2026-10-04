"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, CircleNotch, EnvelopeSimple, WarningCircle, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorKey } from "@/lib/api/error-message";
import { invitationsApi } from "../api";

export function AcceptInvitationView({
  projectId,
  invitationId,
  token,
}: {
  projectId: string;
  invitationId: string;
  token: string | undefined;
}) {
  const t = useTranslations("invitations.respond");
  const te = useTranslations("errors");
  const router = useRouter();
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);

  const accept = useMutation({
    mutationFn: () => invitationsApi.accept(projectId, invitationId, token!),
    onSuccess: () => setDone("accepted"),
    onError: (err) => toast.error(te(errorKey(err))),
  });

  const reject = useMutation({
    mutationFn: () => invitationsApi.reject(projectId, invitationId, token!),
    onSuccess: () => setDone("rejected"),
    onError: (err) => toast.error(te(errorKey(err))),
  });

  if (!token) {
    return (
      <section className="rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
        <WarningCircle size={32} className="text-destructive" aria-hidden="true" />
        <h1 className="mt-5 font-heading text-2xl font-semibold">{t("missingToken")}</h1>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/projects")}>{t("goToProjects")}</Button>
      </section>
    );
  }

  if (done === "accepted") {
    return (
      <section className="rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
        <CheckCircle size={32} className="text-success" aria-hidden="true" />
        <h1 className="mt-5 font-heading text-2xl font-semibold">{t("acceptedMessage")}</h1>
        <Button className="mt-6" onClick={() => router.push("/projects")}>{t("goToProjects")}</Button>
      </section>
    );
  }

  if (done === "rejected") {
    return (
      <section className="rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
        <XCircle size={32} className="text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-5 font-heading text-2xl font-semibold">{t("rejectedMessage")}</h1>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/projects")}>{t("goToProjects")}</Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-8 shadow-sm sm:p-10">
      <EnvelopeSimple size={32} className="text-primary" aria-hidden="true" />
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t("eyebrow")}</p>
      <h1 className="mt-2 font-heading text-2xl font-semibold">{t("prompt")}</h1>
      <div className="mt-7 flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending || accept.isPending}>
          {reject.isPending && <CircleNotch size={16} className="animate-spin" />}
          {t("reject")}
        </Button>
        <Button onClick={() => accept.mutate()} disabled={accept.isPending || reject.isPending}>
          {accept.isPending && <CircleNotch size={16} className="animate-spin" />}
          {t("accept")}
        </Button>
      </div>
    </section>
  );
}
