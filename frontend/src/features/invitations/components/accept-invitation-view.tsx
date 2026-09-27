"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { CircleNotch } from "@phosphor-icons/react";
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
    return <p className="text-sm text-destructive">{t("missingToken")}</p>;
  }

  if (done === "accepted") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-foreground">{t("acceptedMessage")}</p>
        <Button onClick={() => router.push("/projects")}>{t("goToProjects")}</Button>
      </div>
    );
  }

  if (done === "rejected") {
    return <p className="text-sm text-muted-foreground">{t("rejectedMessage")}</p>;
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-foreground">{t("prompt")}</p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending || accept.isPending}>
          {reject.isPending && <CircleNotch size={16} className="animate-spin" />}
          {t("reject")}
        </Button>
        <Button onClick={() => accept.mutate()} disabled={accept.isPending || reject.isPending}>
          {accept.isPending && <CircleNotch size={16} className="animate-spin" />}
          {t("accept")}
        </Button>
      </div>
    </div>
  );
}
