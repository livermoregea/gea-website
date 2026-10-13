import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import CommunityProjectCards from "@/components/CommunityProjectCards";

export const metadata: Metadata = {
  title: "Community In Action | Green Engineering Academy",
  description: "Explore Green Engineering Academy's community outreach, hands-on science projects, and events beyond the classroom.",
};

export default function CommunityPage() {
  return (
    <div className="bg-paper">
      <section className="bg-forestdeep bg-blueprintgrid bg-grid text-paper">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-2">
          <div>
            <Link href="/" className="inline-flex min-h-11 items-center text-sm text-paper/85 transition hover:text-goldlight"><span aria-hidden="true" className="mr-2">←</span> Back to home</Link>
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-goldlight">Beyond the classroom</p>
            <h1 className="mt-4 font-display text-4xl font-medium leading-tight sm:text-6xl">Community<br/><span className="text-goldlight">in action.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/85 sm:text-lg">Engineering connects us to the world around us. Explore the projects where GEA students bring ideas to life and share hands-on science with our community.</p>
          </div>
          <figure className="overflow-hidden rounded-2xl bg-paper/5 ring-1 ring-paper/20">
            <div className="relative aspect-[4/3]">
              <Image src="/images/ssp/headervideo/poster.jpg" alt="GEA students sharing a hands-on science activity with families at Stockmens Park" fill priority sizes="(min-width: 1024px) 550px, 100vw" className="object-cover" />
            </div>
            <figcaption className="px-5 py-4 text-sm text-paper/90">A shared table. A hands-on challenge. Science for everyone.</figcaption>
          </figure>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <section aria-labelledby="community-projects-heading">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest/80">Explore our outreach</p>
          <h2 id="community-projects-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Explore the projects</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-graphite/80">See what we&apos;re building, teaching, and exploring beyond our campus.</p>
          <div className="dim-divider mt-6" />
          <CommunityProjectCards />
        </section>

        <section aria-labelledby="community-contact-heading" className="mt-12 rounded-2xl border border-gold/30 bg-gold/[0.12] p-6 sm:p-8">
          <h2 id="community-contact-heading" className="font-display text-2xl text-forestdeep sm:text-3xl">Have an idea for a community project?</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-graphite/80">Get in touch with GEA to talk about hands-on science, engineering outreach, or opportunities to work together.</p>
          <Link href="/contact" className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-forest px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-paper transition hover:bg-forestdeep">Contact GEA <span aria-hidden="true" className="ml-2">→</span></Link>
        </section>
      </div>
    </div>
  );
}
