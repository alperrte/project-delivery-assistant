import { getTranslations } from "next-intl/server";
import { ErrorScreen } from "@/features/errors/error-screen";
import { errorTitle } from "@/features/errors/types";

export async function generateMetadata() {
  const t = await getTranslations("errorPages");
  return { title: errorTitle("404", t("404.title")) };
}

export default function NotFound() {
  return <ErrorScreen code="404" />;
}
