"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "gea_welcome_popup_dismissed";
const academyApplicationUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSdTDKvYr0IqeTOAl88It9BlaFNkUU359dHG5B6FBzN48W6yng/viewform";

export default function WelcomePopup() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
      setOpen(!dismissed);
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dontShowAgain]);

  function rememberPreference() {
    if (!dontShowAgain) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors, the popup can still close for this session.
    }
  }

  function dismiss() {
    rememberPreference();
    setOpen(false);
  }

  function handleExplore() {
    dismiss();
  }

  if (!mounted || !open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-forestdeep/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-popup-title"
      aria-describedby="welcome-popup-description"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-lg rounded-sm border border-paper/20 bg-paper p-6 shadow-2xl shadow-black/20 ring-1 ring-forest/10 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Welcome
            </p>
            <h2 id="welcome-popup-title" className="mt-2 font-display text-2xl text-forest">
              Welcome to the all new GEA website!
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest/10 text-forestdeep transition hover:border-forest/20 hover:bg-forest/[0.04]"
            aria-label="Close welcome popup"
          >
            ×
          </button>
        </div>

        <p id="welcome-popup-description" className="mt-4 text-sm leading-relaxed text-graphite/75 sm:text-base">
          To apply for leadership roles, click the leadership button below. To apply to the academy,
          click the academy application button below.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/leadership"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-forest px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
          >
            Leadership Application
          </Link>
          <Link
            href={academyApplicationUrl}
            target="_blank"
            rel="noreferrer"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/15 px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] text-forestdeep transition hover:border-forest/30 hover:bg-forest/[0.04]"
          >
            Academy Application
          </Link>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-sm bg-forest/[0.03] px-4 py-3 text-sm text-graphite/75">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
            className="h-4 w-4 rounded border-forest/25 text-forest focus:ring-gold"
          />
          <span>Don&apos;t show again</span>
        </label>

        <button
          type="button"
          onClick={handleExplore}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-[#C8963E] px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-gray-900 transition hover:bg-goldlight"
        >
          Let&apos;s Explore!
        </button>
      </div>
    </div>
  );
}
