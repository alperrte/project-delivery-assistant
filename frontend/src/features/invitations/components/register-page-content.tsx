"use client";

import { useTranslations } from "next-intl";
import { AuthCard } from "@/features/auth/components/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";
import { ExternalInvitationRegistration } from "./external-invitation-registration";
import { useInvitationToken } from "../hooks/use-invitation-token";

export function RegisterPageContent() {
  const t = useTranslations("register");
  const token = useInvitationToken();
  return token ? <ExternalInvitationRegistration />
    : <AuthCard title={t("title")}><RegisterForm /></AuthCard>;
}
