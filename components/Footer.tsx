import Link from "next/link";
import { SocialIcon, socialLinks } from "@/components/SocialIcons";

export default function Footer() {
  return (
    <footer className="border-t border-forest/10 bg-forest text-paper/70">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-start">
          <div>
            <p className="font-display text-base text-gold sm:text-lg">Green Engineering Academy</p>
            <p className="mt-1 font-mono text-xs text-paper/55">
              Livermore High School &middot; 600 Maple Street, Livermore, CA 94550
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-paper/55">
              A California Partnership Academy focused on engineering, design, and real-world
              pathways for Livermore High students.
            </p>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/45">
              GEA: livermoregea.org
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50">
                Follow GEA
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {socialLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-paper/15 bg-paper/5 text-paper transition hover:border-gold hover:text-gold"
                    aria-label={link.label}
                    title={link.label}
                  >
                    <SocialIcon icon={link.icon} className="h-5 w-5" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-sm border border-paper/12 bg-paper/5 px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/50">
                Questions
              </p>
              <p className="mt-2 text-sm leading-relaxed text-paper/70">
                Reach your academic counselor or the GEA coordinators:
              </p>
              <div className="mt-3 space-y-2 text-sm text-paper/75">
                <p>
                  Karen Fletcher:{" "}
                  <a
                    href="mailto:kfletcher@lvjusd.org"
                    className="underline decoration-paper/25 underline-offset-4"
                  >
                    kfletcher@lvjusd.org
                  </a>
                </p>
                <p>
                  Dorothy Morallos:{" "}
                  <a
                    href="mailto:dmorallos@lvjusd.org"
                    className="underline decoration-paper/25 underline-offset-4"
                  >
                    dmorallos@lvjusd.org
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
