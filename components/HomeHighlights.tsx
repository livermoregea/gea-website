const highlights = [
  { label: "Hands-on engineering", icon: "tools" },
  { label: "Four-year pathway", icon: "path" },
  { label: "Learn with a cohort", icon: "people" },
] as const;

function HighlightIcon({ icon }: { icon: (typeof highlights)[number]["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      {icon === "tools" && <><path d="m14 5 5 5M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /><path d="m5 16 3 3" /></>}
      {icon === "path" && <><path d="M5 19h4v-4h5v-5h5V5" /><path d="m15 5h4v4" /></>}
      {icon === "people" && <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" /></>}
    </svg>
  );
}

export default function HomeHighlights() {
  return (
    <section aria-labelledby="home-highlights-heading" className="border-b border-forest/10 bg-[#DCE9DD]">
      <h2 id="home-highlights-heading" className="sr-only">GEA at a glance</h2>
      <ul className="mx-auto grid max-w-6xl divide-y divide-forest/20 px-4 py-3 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 sm:py-5">
        {highlights.map(highlight => (
          <li key={highlight.label} className="flex items-center gap-3 px-3 py-3 text-sm font-semibold text-forestdeep sm:justify-center sm:py-1 md:text-base">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/55 text-forest"><HighlightIcon icon={highlight.icon} /></span>
            <span>{highlight.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
