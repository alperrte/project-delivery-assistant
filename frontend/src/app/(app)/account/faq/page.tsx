import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page-container";
import { FaqContent, type FaqGroup } from "@/features/public-info/faq-content";
import { WorkspaceHelpBack } from "@/features/public-info/workspace-help-back";

export async function generateMetadata() {
  const t = await getTranslations("publicPages.faq");
  return { title: t("title") };
}

export default async function WorkspaceFaqPage() {
  const t = await getTranslations("publicPages.faq");
  return (
    <PageContainer width="form">
      <article data-workspace-faq>
        <WorkspaceHelpBack />
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{t("description")}</p>
        </header>
        <FaqContent groups={t.raw("groups") as FaqGroup[]} idPrefix="workspace-faq-" />
      </article>
    </PageContainer>
  );
}
