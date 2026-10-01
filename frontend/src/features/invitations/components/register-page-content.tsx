"use client";

import { useTranslations } from "next-intl";
import { AuthCard } from "@/features/auth/components/auth-card";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { RegisterForm } from "@/features/auth/components/register-form";
import { ExternalInvitationRegistration } from "./external-invitation-registration";
import { useInvitationToken } from "../hooks/use-invitation-token";

export function RegisterPageContent() {
  const t = useTranslations("register");
  const token = useInvitationToken();
  return token ? <ExternalInvitationRegistration />
    : <AuthCard title={t("title")} subtitle={t("subtitle")}><OAuthButtons /><div className="mt-5"><RegisterForm /></div></AuthCard>;
}
