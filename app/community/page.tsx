import type { Metadata } from "next";
import Link from "next/link";
import CommunityProjectCards from "@/components/CommunityProjectCards";

export const metadata: Metadata = {
  title: "Community In Action | Green Engineering Academy",
  description: "Explore Green Engineering Academy's community outreach, hands-on science projects, and events beyond the classroom.",
};

export default function CommunityPage() {
  return (
    <div className="bg-paper">
      <section className="border-b border-gold/25 bg-forestdeep bg-blueprintgrid bg-grid text-paper">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Link href="/" className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-paper/70 transition hover:text-goldlight">
            <span aria-hidden="true" className="mr-2">←</span> Back to home
          </Link>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-goldlight">Green Engineering Academy · Beyond the classroom</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium leading-tight sm:text-6xl">Community In Action</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-paper/80 sm:text-lg">
            Engineering connects us to the world around us. Explore the projects and events where
            GEA students share hands-on science with our community.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <section aria-labelledby="community-projects-heading">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest/65">Explore our outreach</p>
          <h2 id="community-projects-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Projects &amp; events</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-graphite/75">See what we&apos;re building, teaching, and exploring beyond our campus.</p>
          <div className="dim-divider mt-6" />
          <CommunityProjectCards />
        </section>

        <section aria-labelledby="community-contact-heading" className="mt-16 rounded-sm border border-forest/15 bg-forest/[0.03] p-6 sm:p-8">
          <h2 id="community-contact-heading" className="font-display text-2xl text-forestdeep sm:text-3xl">Have an idea for a community project?</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-graphite/75">Get in touch with GEA to talk about hands-on science, engineering outreach, or opportunities to work together.</p>
          <Link href="/contact" className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-forest px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-paper transition hover:bg-forestdeep">Contact GEA <span aria-hidden="true" className="ml-2">→</span></Link>
        </section>
      </div>
    </div>
  );
}
