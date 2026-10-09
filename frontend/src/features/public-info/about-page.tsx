import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { EnvelopeSimple, FilePdf, LinkedinLogo } from "@phosphor-icons/react/ssr";
import { GitHubIcon } from "@/components/common/brand-icons";
import { PageContents } from "./page-contents";
import { CONTRIBUTORS } from "./site-info";
import { PageJsonLd } from "@/lib/seo/json-ld";
import { Breadcrumb } from "@/components/common/breadcrumb";

const STORY = ["journey", "pda", "goal"] as const;

const linkClass = "inline-flex min-h-11 w-full items-center gap-3 break-all rounded-md py-2 text-sm underline-offset-4 outline-hidden hover:text-primary hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

/** Link text without the scheme, the "www." and a trailing slash; percent-escapes are shown as the letters they stand for. */
const shortUrl = (url: string) => decodeURIComponent(url.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, ""));

export async function AboutPage() {
  const t = await getTranslations("publicPages.about");
  const common = await getTranslations("publicPages.common");
  const app = await getTranslations("common");
  const landing = await getTranslations("landing");
  const contents = [...STORY.map(key => ({ id: key, title: t(key + ".title") })), { id: "team", title: t("team.title") }];

  return (
    <article>
      <Breadcrumb label={app("breadcrumb")} items={[{ label: landing("homeTitle"), href: "/" }, { label: t("title") }]} className="mb-6" />
      <PageJsonLd route="/about" type="AboutPage" name={t("title")} description={t("description")} />
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">PDA · Project Delivery Assistant</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-6 text-xl leading-8">{t("lead")}</p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <PageContents label={common("contents")} items={contents} />
        <div className="min-w-0">
          <div className="max-w-3xl space-y-10">
            {STORY.map(key => (
              <section key={key} id={key} aria-labelledby={key + "-title"} className="scroll-mt-6 border-l-2 border-primary/40 pl-5 sm:pl-6">
                <h2 id={key + "-title"} className="mb-3 text-xl font-semibold">{t(key + ".title")}</h2>
                <div className="space-y-4 text-base leading-7 text-muted-foreground">
                  {(t.raw(key + ".paragraphs") as string[]).map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>

          <section id="team" aria-labelledby="team-title" className="mt-14 scroll-mt-6">
            <h2 id="team-title" className="text-xl font-semibold">{t("team.title")}</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">{t("team.intro")}</p>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2">
              {CONTRIBUTORS.map(({ name, github, linkedin, email, cv, photo }) => (
                <li key={github} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex flex-col items-center bg-linear-to-br from-primary/15 via-primary/5 to-transparent px-6 pb-5 pt-6 text-center">
                    <Image src={photo} alt={t("team.photoAlt", { name })} width={240} height={240} className="size-28 rounded-full border-4 border-background object-cover shadow-sm" />
                    <h3 className="mt-4 text-xl font-semibold">{name}</h3>
                    <p className="mt-2 inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">{t("role")}</p>
                  </div>
                  <ul className="divide-y divide-border border-t border-border px-6 py-1">
                    <li>
                      <a href={github} className={linkClass}>
                        <GitHubIcon className="size-4 shrink-0" />{github.replace("https://", "")}
                      </a>
                    </li>
                    <li>
                      <a href={linkedin} className={linkClass}>
                        <LinkedinLogo size={17} aria-hidden="true" className="shrink-0" />{shortUrl(linkedin)}
                      </a>
                    </li>
                    <li>
                      <a href={"mailto:" + email} className={linkClass}>
                        <EnvelopeSimple size={17} aria-hidden="true" className="shrink-0" />{email}
                      </a>
                    </li>
                    <li>
                      <a href={cv} target="_blank" rel="noopener" className={linkClass}>
                        <FilePdf size={17} aria-hidden="true" className="shrink-0" />{t("team.cv")}
                      </a>
                    </li>
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </article>
  );
}
