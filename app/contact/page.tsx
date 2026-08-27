import Link from "next/link";
import { SocialIcon, socialLinks } from "@/components/SocialIcons";

const counselingServicesUrl =
  "https://livermorehigh.livermoreschools.org/student-life/counseling-services/general-information";

const geaCoordinators = [
  {
    name: "Karen Fletcher",
    email: "kfletcher@lvjusd.org",
  },
  {
    name: "Dorothy Morallos",
    email: "dmorallos@lvjusd.org",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <div className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Contact Us</p>
        <h1 className="mt-4 font-display text-3xl font-medium text-forest sm:text-4xl md:text-5xl">
          GEA contact page
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-graphite/75 sm:text-base">
          Use this page for GEA coordinators, the GEA email, the official counseling-services
          page, and our social media links.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">GEA Coordinators</p>
            <div className="mt-5 grid gap-4">
              {geaCoordinators.map((contact) => (
                <div key={contact.email} className="rounded-sm border border-forest/10 bg-forest/[0.03] p-4">
                  <p className="font-display text-lg text-forest">{contact.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.15em] text-gold">GEA Coordinator</p>
                  <p className="mt-2 text-sm text-graphite/70">{contact.email}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">
              Livermore High Counseling Services
            </p>
            <div className="mt-4 rounded-sm border border-forest/10 bg-forest/[0.03] p-4">
              <p className="font-display text-lg text-forest">Official counselor list</p>
              <p className="mt-2 text-sm leading-relaxed text-graphite/70">
                Visit the school counseling page for the current academic counselors and student
                last-name assignments.
              </p>
              <Link
                href={counselingServicesUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest transition hover:bg-forest/[0.03]"
              >
                Open Counseling Page
              </Link>
            </div>
          </section>

          <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">General Contact</p>
            <div className="mt-4 rounded-sm border border-forest/10 bg-forest/[0.03] p-4">
              <p className="font-display text-lg text-forest">Green Engineering Academy</p>
              <p className="mt-1 text-sm text-graphite/70">livermoregea@gmail.com</p>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Social Media</p>
            <p className="mt-2 text-sm leading-relaxed text-graphite/70">
              Follow GEA on our official channels.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {socialLinks.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-3 rounded-full border border-forest/10 bg-paper px-4 py-2 text-forest transition hover:border-gold hover:bg-paper/90"
                  aria-label={social.label}
                >
                  <SocialIcon icon={social.icon} className="h-5 w-5" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em]">{social.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Need Help?</p>
            <p className="mt-2 text-sm leading-relaxed text-graphite/70">
              If you are not sure who to contact, start with the general GEA email and we will point
              you in the right direction.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/qa"
                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest transition hover:bg-forest/[0.03]"
              >
                FAQ
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
              >
                Home
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
