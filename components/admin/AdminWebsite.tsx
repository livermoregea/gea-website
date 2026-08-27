"use client";

import { useEffect, useState } from "react";
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

type AnnouncementDraft = {
  kind: AnnouncementKind;
  is_enabled: boolean;
  scope: AnnouncementScope;
  title: string;
  body: string;
  buttons: AnnouncementButton[];
  allow_dont_show_again: boolean;
};

const EMPTY_BUTTON = {
  label: "",
  href: "",
  variant: "secondary" as ButtonVariant,
  newTab: false,
};

function createEmptyDraft(kind: AnnouncementKind): AnnouncementDraft {
  return {
    kind,
    is_enabled: false,
    scope: "site",
    title: "",
    body: "",
    buttons: [],
    allow_dont_show_again: true,
  };
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
      const label = typeof candidate.label === "string" ? candidate.label : "";
      const href = typeof candidate.href === "string" ? candidate.href : "";
      const variant = typeof candidate.variant === "string" && isButtonVariant(candidate.variant)
        ? candidate.variant
        : "secondary";
      const newTab = Boolean(candidate.newTab);
      return { label, href, variant, newTab };
    })
    .filter(
      (button): button is AnnouncementButton =>
        button !== null && Boolean(button.label.trim() && button.href.trim())
    );
}

function fieldLabel(kind: AnnouncementKind) {
  return kind === "popup" ? "Popup" : "Banner";
}

export default function AdminWebsite() {
  const [drafts, setDrafts] = useState<Record<AnnouncementKind, AnnouncementDraft>>({
    popup: createEmptyDraft("popup"),
    banner: createEmptyDraft("banner"),
  });
  const [loading, setLoading] = useState(true);
  const [savingKind, setSavingKind] = useState<AnnouncementKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);

    if (!hasSupabaseConfig()) {
      setDrafts({
        popup: createEmptyDraft("popup"),
        banner: createEmptyDraft("banner"),
      });
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("website_announcements")
      .select("kind, is_enabled, scope, title, body, buttons, allow_dont_show_again")
      .order("kind", { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const nextDrafts = {
      popup: createEmptyDraft("popup"),
      banner: createEmptyDraft("banner"),
    } satisfies Record<AnnouncementKind, AnnouncementDraft>;

    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const kind = row.kind === "banner" ? "banner" : "popup";
      const scope = row.scope === "home" ? "home" : "site";
      nextDrafts[kind] = {
        kind,
        is_enabled: Boolean(row.is_enabled),
        scope,
        title: typeof row.title === "string" ? row.title : "",
        body: typeof row.body === "string" ? row.body : "",
        buttons: normalizeButtons(row.buttons),
        allow_dont_show_again: Boolean(row.allow_dont_show_again ?? true),
      };
    }

    setDrafts(nextDrafts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateDraft(kind: AnnouncementKind, updater: (current: AnnouncementDraft) => AnnouncementDraft) {
    setDrafts((current) => ({
      ...current,
      [kind]: updater(current[kind]),
    }));
  }

  function updateButton(
    kind: AnnouncementKind,
    index: number,
    field: keyof AnnouncementButton,
    value: string | boolean
  ) {
    updateDraft(kind, (current) => {
      const buttons = current.buttons.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, [field]: value } : button
      );
      return { ...current, buttons };
    });
  }

  function addButton(kind: AnnouncementKind) {
    updateDraft(kind, (current) => ({
      ...current,
      buttons: [...current.buttons, { ...EMPTY_BUTTON }],
    }));
  }

  function removeButton(kind: AnnouncementKind, index: number) {
    updateDraft(kind, (current) => ({
      ...current,
      buttons: current.buttons.filter((_, buttonIndex) => buttonIndex !== index),
    }));
  }

  async function saveAnnouncement(kind: AnnouncementKind) {
    if (!hasSupabaseConfig()) return;

    setSavingKind(kind);
    setMessage(null);

    const supabase = createClient();
    const draft = drafts[kind];
    const { error } = await supabase.from("website_announcements").upsert(
      {
        kind,
        is_enabled: draft.is_enabled,
        scope: draft.scope,
        title: draft.title.trim(),
        body: draft.body.trim(),
        buttons: draft.buttons,
        allow_dont_show_again: draft.allow_dont_show_again,
      },
      { onConflict: "kind" }
    );

    setSavingKind(null);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${fieldLabel(kind)} updated.`);
    load();
  }

  if (loading) return <p className="text-sm text-graphite/50">Loading website settings...</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-sm bg-paper p-5 ring-1 ring-forest/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Website</p>
            <h3 className="mt-2 font-display text-2xl text-forest">Popup and banner content</h3>
          </div>
          <p className="text-sm text-graphite/60">
            Edit what visitors see before sign-in and what appears across the site.
          </p>
        </div>
      </section>

      {message && (
        <p className="rounded-sm bg-forest/[0.05] p-4 text-sm text-graphite/80 ring-1 ring-forest/10">
          {message}
        </p>
      )}

      {(["popup", "banner"] as AnnouncementKind[]).map((kind) => {
        const draft = drafts[kind];
        return (
          <section key={kind} className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                  {fieldLabel(kind)}
                </p>
                <h4 className="mt-2 font-display text-xl text-forest">
                  {kind === "popup" ? "Visitor popup" : "Site banner"}
                </h4>
              </div>
              <label className="flex items-center gap-2 rounded-sm bg-paper px-3 py-2 text-sm text-graphite/75 ring-1 ring-forest/10">
                <input
                  type="checkbox"
                  checked={draft.is_enabled}
                  onChange={(event) =>
                    updateDraft(kind, (current) => ({ ...current, is_enabled: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-forest/25 text-forest focus:ring-gold"
                />
                <span>Enabled</span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-graphite/50">
                  Title
                </label>
                <input
                  value={draft.title}
                  onChange={(event) =>
                    updateDraft(kind, (current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder={kind === "popup" ? "Welcome to GEA" : "Important update"}
                  className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-graphite/50">
                  Show where?
                </label>
                <select
                  value={draft.scope}
                  onChange={(event) =>
                    updateDraft(kind, (current) => ({
                      ...current,
                      scope: event.target.value === "home" ? "home" : "site",
                    }))
                  }
                  className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
                >
                  <option value="site">Entire site</option>
                  <option value="home">Main page only</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-graphite/50">
                Message
              </label>
              <textarea
                value={draft.body}
                onChange={(event) =>
                  updateDraft(kind, (current) => ({ ...current, body: event.target.value }))
                }
                rows={6}
                placeholder={
                  kind === "popup"
                    ? "Write a detailed message for first-time visitors."
                    : "Write a short announcement for the banner."
                }
                className="mt-2 w-full rounded-sm border border-forest/15 bg-paper px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            {kind === "popup" && (
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-sm bg-paper px-4 py-3 text-sm text-graphite/75 ring-1 ring-forest/10">
                <input
                  type="checkbox"
                  checked={draft.allow_dont_show_again}
                  onChange={(event) =>
                    updateDraft(kind, (current) => ({
                      ...current,
                      allow_dont_show_again: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-forest/25 text-forest focus:ring-gold"
                />
                <span>Allow “Don&apos;t show again”</span>
              </label>
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-graphite/50">
                  Buttons
                </label>
                <button
                  type="button"
                  onClick={() => addButton(kind)}
                  className="rounded-sm border border-forest/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-forest transition hover:bg-forest/[0.04]"
                >
                  Add Button
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {draft.buttons.length === 0 && (
                  <p className="text-sm text-graphite/50">No buttons yet.</p>
                )}
                {draft.buttons.map((button, index) => (
                  <div key={`${kind}-button-${index}`} className="rounded-sm bg-paper p-4 ring-1 ring-forest/10">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={button.label}
                        onChange={(event) => updateButton(kind, index, "label", event.target.value)}
                        placeholder="Button label"
                        className="w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                      />
                      <input
                        value={button.href}
                        onChange={(event) => updateButton(kind, index, "href", event.target.value)}
                        placeholder="Button link"
                        className="w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                      />
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <label className="text-sm text-graphite/70">
                        <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-graphite/50">
                          Style
                        </span>
                        <select
                          value={button.variant}
                          onChange={(event) =>
                            updateButton(kind, index, "variant", event.target.value)
                          }
                          className="w-full rounded-sm border border-forest/15 bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                        >
                          <option value="primary">Primary</option>
                          <option value="secondary">Secondary</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 rounded-sm bg-forest/[0.03] px-3 py-2 text-sm text-graphite/70">
                        <input
                          type="checkbox"
                          checked={button.newTab}
                          onChange={(event) => updateButton(kind, index, "newTab", event.target.checked)}
                          className="h-4 w-4 rounded border-forest/25 text-forest focus:ring-gold"
                        />
                        <span>Open in new tab</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeButton(kind, index)}
                        className="rounded-sm border border-red-700/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => saveAnnouncement(kind)}
                disabled={savingKind === kind}
                className="inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep disabled:opacity-50"
              >
                {savingKind === kind ? "Saving..." : `Save ${fieldLabel(kind)}`}
              </button>
              <button
                type="button"
                onClick={() => load()}
                className="inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-forest transition hover:bg-forest/[0.04]"
              >
                Reset
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
