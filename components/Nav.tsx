"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/curriculum", label: "Curriculum" },
  { href: "/leadership", label: "Leadership" },
  { href: "/qa", label: "Q&A" },
];

const academyApplicationUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSdTDKvYr0IqeTOAl88It9BlaFNkUU359dHG5B6FBzN48W6yng/viewform";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-forest/10 bg-paper/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper">
              <Image
                src="/images/logo.png"
                alt="Green Engineering Academy logo"
                width={40}
                height={40}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-display text-sm font-medium tracking-wide text-forestdeep sm:text-base">
                Green Engineering Academy
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-graphite/65">
                Livermore High School
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname === l.href ? "page" : undefined}
                className="rounded-sm font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:text-forest aria-[current=page]:text-forest"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href={academyApplicationUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden min-h-11 items-center rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep sm:inline-flex"
          >
            Apply to GEA Now!
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-4 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            className="mt-3 grid gap-2 rounded-sm border border-forest/10 bg-paper p-3 md:hidden"
            aria-label="Mobile primary"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === l.href ? "page" : undefined}
                className="rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:bg-forest/[0.06] aria-[current=page]:bg-forest/[0.08]"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={academyApplicationUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="rounded-sm bg-forest px-3 py-2 text-center font-mono text-xs uppercase tracking-[0.15em] text-gold"
            >
              Apply to GEA Now!
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
