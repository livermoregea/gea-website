"use client";

import GEAOneBadge from "@/components/GEAOneBadge";

import { BUILDERS_ENABLED } from "@/lib/site-features";
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
  ...(BUILDERS_ENABLED ? [{ href: "/builders", label: "Builders" }] : []),
  { href: "/qa", label: "Q&A" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!open && !accountOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (accountOpen) { setAccountOpen(false); accountButtonRef.current?.focus(); }
      if (open) { setOpen(false); mobileButtonRef.current?.focus(); }
    }
    function handleFocus(event: FocusEvent) {
      if (accountOpen && accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("focusin", handleFocus);
    };
  }, [open, accountOpen]);

  async function handleSignOut() {
    if (!hasSupabaseConfig() || signingOut) return;
    if (!window.dispatchEvent(new Event("gea:before-navigation", { cancelable: true }))) return;
    setSigningOut(true); setAccountError(null);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) { setAccountError("Could not sign out. Check your connection and try again."); return; }
      setIsSignedIn(false); setAccountOpen(false); setOpen(false);
      router.push("/"); router.refresh();
    } catch { setAccountError("Could not sign out. Check your connection and try again."); }
    finally { setSigningOut(false); }
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
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-graphite/80">
                Livermore High School
              </span>
            </span>
          </Link>
          <nav className="hidden shrink-0 items-center gap-6 lg:flex xl:gap-8" aria-label="Primary">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`)) ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-sm font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:text-forest aria-[current=page]:text-forest"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden shrink-0 items-center sm:flex">
            <div ref={accountRef} className="relative">
              {accountReady && isSignedIn ? (
                <>
                  <button
                    ref={accountButtonRef}
                    type="button"
                    aria-controls="account-links"
                    onClick={() => setAccountOpen((value) => !value)}
                    className="inline-flex min-h-11 items-center rounded-full transition hover:opacity-90"
                    aria-label="GEA One account menu"
                    aria-expanded={accountOpen}
                  >
                    <GEAOneBadge size="compact" />
                  </button>
                  {accountOpen && (
                    <div id="account-links" className="absolute right-0 top-full z-50 mt-2 w-56 rounded-sm border border-forest/10 bg-paper p-2 shadow-lg shadow-forest/10">
                      <Link
                        href="/account/redirect"
                        onClick={() => setAccountOpen(false)}
                        className="flex min-h-11 items-center rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:bg-forest/[0.06]"
                      >
                        Head to home
                      </Link>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        aria-busy={signingOut}
                        className="flex w-full items-center justify-start rounded-sm px-3 py-2 text-left font-mono text-xs uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-50"
                      >
                        {signingOut ? "Signing out…" : "Sign out"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-forest/20 px-5 py-2 font-mono text-xs uppercase tracking-[0.12em] text-forest transition hover:bg-forest/5"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
          <button
            ref={mobileButtonRef}
            type="button"
            className="inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-4 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
        {accountError && <p role="alert" className="mt-3 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{accountError}</p>}
        {open && (
          <nav
            id="mobile-nav"
            className="mt-3 grid gap-2 rounded-sm border border-forest/10 bg-paper p-3 lg:hidden"
            aria-label="Mobile primary"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`)) ? "page" : undefined}
                className="flex min-h-11 items-center justify-start rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:bg-forest/[0.06] aria-[current=page]:bg-forest/[0.08]"
              >
                {l.label}
              </Link>
            ))}
            {accountReady && isSignedIn ? (
              <>
                <Link
                  href="/account/redirect"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center justify-start rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:bg-forest/[0.06]"
                >
                  Head to home
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  aria-busy={signingOut}
                  className="flex min-h-11 items-center justify-start rounded-sm px-3 py-2 text-left font-mono text-xs uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-50"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center justify-start rounded-sm px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:bg-forest/[0.06]"
              >
                Sign in
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
