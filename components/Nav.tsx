"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

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
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setAccountReady(true);
      setIsSignedIn(false);
      return;
    }

    const supabase = createClient();
    let mounted = true;

    supabase.auth.getUser().then(({ data }: { data: { user: unknown | null } }) => {
      if (!mounted) return;
      setIsSignedIn(Boolean(data.user));
      setAccountReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (!mounted) return;
      setIsSignedIn(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    if (!hasSupabaseConfig()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsSignedIn(false);
    setAccountOpen(false);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

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
          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href={academyApplicationUrl}
              target="_blank"
              rel="noreferrer"
              className="min-h-11 items-center rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep sm:inline-flex"
            >
              Apply to GEA Now!
            </Link>
            <div ref={accountRef} className="relative">
              {accountReady && isSignedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((value) => !value)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-forest/15 bg-paper text-forestdeep transition hover:border-forest/30 hover:bg-forest/[0.04]"
                    aria-label="Account menu"
                    aria-expanded={accountOpen}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12 12.2a4.6 4.6 0 1 0-4.6-4.6 4.6 4.6 0 0 0 4.6 4.6Zm0 2.1c-4.3 0-8 2.2-8 4.9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1c0-2.7-3.7-4.9-8-4.9Z"
                      />
                    </svg>
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-sm border border-forest/10 bg-paper p-2 shadow-lg shadow-forest/10">
                      <Link
                        href="/profile"
                        onClick={() => setAccountOpen(false)}
                        className="block rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:bg-forest/[0.06]"
                      >
                        View Profile
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="block w-full rounded-sm px-3 py-2 text-left font-mono text-xs uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-50"
                      >
                        Log Out
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center rounded-full border border-forest/15 px-4 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:border-forest/30 hover:bg-forest/[0.04]"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
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
            {accountReady && isSignedIn ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:bg-forest/[0.06]"
                >
                  View Profile
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-sm px-3 py-2 text-left font-mono text-xs uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-50"
                >
                  Log Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:bg-forest/[0.06]"
              >
                Sign In
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
