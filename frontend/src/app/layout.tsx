import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Exo_2, Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { WebVitalsDebug } from "@/features/analytics/web-vitals-debug";
import type { Locale } from "@/i18n/config";
import { clientMessages } from "@/i18n/client-messages";
import { RENDERER_BOOT_SCRIPT } from "@/lib/rendering";
import { OG_IMAGE, openGraphLocale } from "@/lib/seo/alternates";
import "./globals.css";

// Load fonts when their text is rendered instead of preloading every family/subset on every route.
// Variable font: every weight from one file.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: {
      default: "PDA · Project Delivery Assistant",
      template: "%s · PDA",
    },
    description: "Öğrenciler ve küçük ekipler için self-hosted proje teslim asistanı.",
    openGraph: {
      type: "website",
      siteName: "PDA · Project Delivery Assistant",
      images: [OG_IMAGE],
      ...openGraphLocale(await getLocale() as Locale),
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e14" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = clientMessages(await getMessages());

  return (
    <html
      lang={locale}
      data-motion="on"
      className={`${inter.variable} ${exo2.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: RENDERER_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-[100dvh]">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
          {process.env.NODE_ENV !== "production" && <WebVitalsDebug />}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
