import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page-container";
import { ContactPage } from "@/features/contact/contact-page";

export async function generateMetadata() {
  const t = await getTranslations("contact");
  return { title: t("title") };
}

export default function WorkspaceContactPage() {
  return <PageContainer width="centered"><ContactPage workspace /></PageContainer>;
}
