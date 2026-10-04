"use client";
import { useTranslations } from "next-intl";
import { ImagePicker } from "@/components/common/image-picker";
import { LOGO_MAX_BYTES } from "@/lib/media/image-validation";
export function LogoField({ name, previewUrl, onChange }: { name: string; previewUrl: string | null; onChange: (file: File | null) => void }) {
  const t = useTranslations("projects.newPage.logo");
  return <ImagePicker name={name} src={previewUrl} onChange={onChange} maximum={LOGO_MAX_BYTES} labels={{
    label: t("label"), choose: t("choose"), change: t("change"), remove: t("remove"), hint: t("hint"), invalidType: t("invalidType"), tooLarge: t("tooLarge"), empty: t("empty"),
  }} />;
}
