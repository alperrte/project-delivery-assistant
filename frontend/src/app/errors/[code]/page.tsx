import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ErrorScreen } from "@/features/errors/error-screen";
import { ERROR_CODES, isErrorCode } from "@/features/errors/types";

export function generateStaticParams() {
  return ERROR_CODES.map(code => ({ code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isErrorCode(code)) notFound();
  const t = await getTranslations("errorPages");
  return { title: `${code} · ${t(`${code}.title`)}`, robots: { index: false, follow: false } };
}

/** Safe visual previews: these routes do not cause a crash or change any permissions. */
export default async function ErrorPreview({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isErrorCode(code)) notFound();
  return <ErrorScreen code={code} />;
}
