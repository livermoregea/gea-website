import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "katex/dist/katex.min.css";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SiteAnnouncements from "@/components/SiteAnnouncements";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import type { WebsiteAnnouncement } from "@/components/SiteAnnouncements";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "GEA Official Website",
  description:
    "The Green Engineering Academy (GEA) at Livermore High School prepares students for careers in engineering, sustainability, and STEM through hands-on projects, industry mentorship, and a four-year cohort pathway.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialAnnouncements: WebsiteAnnouncement[] = [];
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("website_announcements")
      .select("kind, is_enabled, scope, title, body, buttons, allow_dont_show_again, updated_at")
      .eq("is_enabled", true);
    initialAnnouncements = (data as WebsiteAnnouncement[]) ?? [];
  }

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen font-body antialiased" suppressHydrationWarning>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-gold focus:px-4 focus:py-2 focus:text-forestdeep"
        >
          Skip to content
        </a>
        <Nav />
        <SiteAnnouncements initialAnnouncements={initialAnnouncements} />
        <main id="content" className="min-h-screen">
          {children}
        </main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
