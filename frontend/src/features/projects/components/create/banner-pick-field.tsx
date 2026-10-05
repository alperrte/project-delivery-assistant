"use client";
import { useTranslations } from "next-intl";
import { ImagePicker } from "@/components/common/image-picker";
import { COVER_MAX_BYTES } from "@/lib/media/image-validation";
export function BannerPickField({ previewUrl, onChange }: { previewUrl: string | null; onChange: (file: File | null) => void }) {
  const t = useTranslations("projects.newPage.banner");
  return <ImagePicker cover src={previewUrl} onChange={onChange} maximum={COVER_MAX_BYTES} labels={{
    label: t("label"), choose: t("choose"), change: t("change"), remove: t("remove"), hint: t("hint"), invalidType: t("invalidType"), tooLarge: t("tooLarge"), empty: t("empty"),
  }} />;
}
