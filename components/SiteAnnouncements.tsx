"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type AnnouncementKind = "popup" | "banner";
type AnnouncementScope = "site" | "home";
type ButtonVariant = "primary" | "secondary";

type AnnouncementButton = {
  label: string;
  href: string;
  variant: ButtonVariant;
  newTab: boolean;
};

type WebsiteAnnouncement = {
  kind: AnnouncementKind;
  is_enabled: boolean;
  scope: AnnouncementScope;
  title: string;
  body: string;
  buttons: AnnouncementButton[] | null;
  allow_dont_show_again: boolean;
  updated_at: string;
};

const DISMISS_PREFIX = "gea_website_announcement";

function isAnnouncementScope(scope: string): scope is AnnouncementScope {
  return scope === "site" || scope === "home";
}

function isButtonVariant(value: string): value is ButtonVariant {
  return value === "primary" || value === "secondary";
}

function normalizeButtons(value: unknown): AnnouncementButton[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((button) => {
      if (!button || typeof button !== "object") return null;
      const candidate = button as Record<string, unknown>;
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      const href = typeof candidate.href === "string" ? candidate.href.trim() : "";
      const variant = typeof candidate.variant === "string" && isButtonVariant(candidate.variant)
        ? candidate.variant
        : "secondary";
      const newTab = Boolean(candidate.newTab);
      if (!label || !href) return null;
      return { label, href, variant, newTab };
    })
    .filter((button): button is AnnouncementButton => button !== null);
}

function buttonClasses(variant: ButtonVariant) {
  if (variant === "primary") {
    return "bg-forest text-gold hover:bg-forestdeep";
  }
  return "border border-forest/15 text-forest hover:bg-forest/[0.04]";
}

function storageKey(announcement: WebsiteAnnouncement) {
  return `${DISMISS_PREFIX}:${announcement.kind}:${announcement.updated_at}`;
}

export default function SiteAnnouncements() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [banner, setBanner] = useState<WebsiteAnnouncement | null>(null);
  const [popup, setPopup] = useState<WebsiteAnnouncement | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    setMounted(true);

    async function load() {
      if (!hasSupabaseConfig()) {
        setBanner(null);
        setPopup(null);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase
        .from("website_announcements")
        .select("kind, is_enabled, scope, title, body, buttons, allow_dont_show_again, updated_at")
        .eq("is_enabled", true);

      const rows = ((data as WebsiteAnnouncement[]) ?? []).filter((row) => isAnnouncementScope(row.scope));
      const nextBanner = rows.find((row) => row.kind === "banner" && (row.scope === "site" || pathname === "/")) ?? null;
      const nextPopup = rows.find((row) => row.kind === "popup" && (row.scope === "site" || pathname === "/")) ?? null;

      setBanner(nextBanner);
      setPopup(nextPopup);
    }

    load();
  }, [pathname]);

  useEffect(() => {
    if (!popup) {
      setPopupOpen(false);
      setDontShowAgain(false);
      return;
    }

    const key = storageKey(popup);
    try {
      const sessionDismissed = window.sessionStorage.getItem(key) === "1";
      const permanentDismissed = window.localStorage.getItem(key) === "1";
      setPopupOpen(!(sessionDismissed || permanentDismissed));
    } catch {
      setPopupOpen(true);
    }
  }, [popup]);

  function dismiss(persist: boolean) {
    if (!popup) return;

    const key = storageKey(popup);
    try {
      if (persist) {
        window.localStorage.setItem(key, "1");
      } else {
        window.sessionStorage.setItem(key, "1");
      }
    } catch {
      // Ignore storage errors. The modal can still close for this session.
    }

    setPopupOpen(false);
  }

  const popupButtons = useMemo(() => normalizeButtons(popup?.buttons ?? []), [popup]);
  const bannerButtons = useMemo(() => normalizeButtons(banner?.buttons ?? []), [banner]);

  if (!mounted) {
    return null;
  }

  return (
    <>
      {banner && (
        <div className="border-b border-gold/20 bg-[#173f2c] text-paper shadow-[0_10px_30px_rgba(18,53,36,0.08)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold/90">
                GEA Update
              </p>
              <h2 className="mt-2 font-display text-lg text-paper sm:text-xl">{banner.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-paper/80 whitespace-pre-wrap">
                {banner.body}
              </p>
            </div>
            {bannerButtons.length > 0 && (
              <div className="flex flex-wrap gap-3 lg:justify-end">
                {bannerButtons.map((button) => (
                  <a
                    key={`${banner.kind}-${button.label}-${button.href}`}
                    href={button.href}
                    target={button.newTab ? "_blank" : undefined}
                    rel={button.newTab ? "noreferrer" : undefined}
                    className={`inline-flex min-h-11 items-center justify-center rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] transition ${buttonClasses(button.variant)}`}
                  >
                    {button.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {popup && popupOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-forestdeep/70 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="website-popup-title"
          aria-describedby="website-popup-description"
          onClick={() => dismiss(false)}
        >
          <div
            className="w-full max-w-2xl rounded-sm border border-paper/20 bg-paper p-6 shadow-2xl shadow-black/20 ring-1 ring-forest/10 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                  {popup.kind === "popup" ? "Website Notice" : "Announcement"}
                </p>
                <h2 id="website-popup-title" className="mt-2 font-display text-2xl text-forest">
                  {popup.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => dismiss(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-forest/10 text-forestdeep transition hover:border-forest/20 hover:bg-forest/[0.04]"
                aria-label="Close popup"
              >
                ×
              </button>
            </div>

            <p
              id="website-popup-description"
              className="mt-4 text-sm leading-relaxed text-graphite/75 sm:text-base whitespace-pre-wrap"
            >
              {popup.body}
            </p>

            {popupButtons.length > 0 && (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {popupButtons.map((button) => (
                  <a
                    key={`${popup.kind}-${button.label}-${button.href}`}
                    href={button.href}
                    target={button.newTab ? "_blank" : undefined}
                    rel={button.newTab ? "noreferrer" : undefined}
                    onClick={() => dismiss(false)}
                    className={`inline-flex min-h-11 items-center justify-center rounded-sm px-4 py-3 text-center font-mono text-xs uppercase tracking-[0.15em] transition ${buttonClasses(button.variant)}`}
                  >
                    {button.label}
                  </a>
                ))}
              </div>
            )}

            {popup.allow_dont_show_again && (
              <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-sm bg-forest/[0.03] px-4 py-3 text-sm text-graphite/75">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(event) => setDontShowAgain(event.target.checked)}
                  className="h-4 w-4 rounded border-forest/25 text-forest focus:ring-gold"
                />
                <span>Don&apos;t show again</span>
              </label>
            )}

            <button
              type="button"
              onClick={() => dismiss(dontShowAgain)}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-[#C8963E] px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-gray-900 transition hover:bg-goldlight"
            >
              {popup.allow_dont_show_again && dontShowAgain ? "Hide Forever" : "Not Now"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
