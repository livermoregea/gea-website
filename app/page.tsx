import Link from "next/link";
import HomeHeroCarousel from "@/components/HomeHeroCarousel";

const benefits = [
  {
    label: "Cohort Model",
    body: "The same students and teachers stay together across all four years, so support and mentorship compound instead of resetting every fall.",
  },
  {
    label: "Industry Tools",
    body: "Students design in CAD, model structures, and prototype with the same engineering software used in professional firms — not simplified classroom versions.",
  },
  {
    label: "Real Partners",
    body: "Field trips, guest engineers, and mentorships connect coursework to actual sustainability and manufacturing work happening right now.",
  },
  {
    label: "College-Ready Rigor",
    body: "Every GEA course is UC/CSU approved, layering AP options and PLTW engineering credit onto a standard college-prep transcript.",
  },
];

const sequence = [
  { year: "Freshman", focus: "Intro to Engineering Design", note: "Foundations in drafting, design thinking, and the engineering process." },
  { year: "Sophomore", focus: "Principles of Engineering", note: "Mechanisms, energy, and materials — the physics behind the machines." },
  { year: "Junior", focus: "Civil Engineering & Architecture", note: "Structural design and sustainable building, honors-weighted." },
  { year: "Senior", focus: "Engineering Capstone", note: "An independent, portfolio-defining project from concept to presentation." },
];

const academyApplicationUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSdTDKvYr0IqeTOAl88It9BlaFNkUU359dHG5B6FBzN48W6yng/viewform";

function HeroCopy() {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/90">
        LHS Green Engineering Academy · Est. 2010
      </p>
      <h1 className="mt-5 max-w-3xl font-display text-3xl font-medium leading-[1.08] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)] sm:text-4xl md:mt-6 md:text-6xl">
        Engineering education built for where the job market is headed.
      </h1>
      <p className="mt-5 max-w-xl text-sm leading-relaxed text-gray-200 drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)] sm:text-base md:mt-6 md:text-lg">
        STEM careers are the fastest-growing segment of the workforce, and the shift toward
        renewable energy, sustainable design, and advanced manufacturing isn&apos;t slowing down.
        GEA gives Livermore High students a four-year head start: real engineering software, a
        dedicated cohort, and a curriculum built around the industries that will define the next
        decade.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
        <Link
          href="/curriculum"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-[#C8963E] px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-gray-900 transition hover:bg-goldlight sm:w-auto"
        >
          Explore the Curriculum
        </Link>
        <Link
          href="/leadership"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-white/30 px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-white transition hover:border-white hover:text-white sm:w-auto"
        >
          Student Leadership
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative w-full h-[80vh] md:h-[85vh] min-h-[550px] overflow-hidden bg-gray-900">
        <HomeHeroCarousel />
        <div className="relative z-10 container mx-auto h-full flex flex-col justify-end pb-20 px-6 md:px-12">
          <div className="max-w-3xl">
            <HeroCopy />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl font-medium text-gray-900 sm:text-2xl md:text-3xl">
            Why a partnership academy, not just a class
          </h2>
        </div>
        <div className="dim-divider mt-6" />
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {benefits.map((b) => (
            <div key={b.label} className="border-l-2 border-gold/60 pl-5">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#1A362B]">
                {b.label}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-graphite/80">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Course Sequence */}
      <section className="bg-forest/[0.03] py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-xl font-medium text-gray-900 sm:text-2xl md:text-3xl">
            A four-year pathway, one cohort
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-graphite/70 sm:text-base">
            Every GEA student takes their core courses alongside the same classmates, layering
            engineering coursework onto a full college-prep schedule.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-4 md:gap-6">
            {sequence.map((s, i) => (
              <div
                key={s.year}
                className="flex h-full min-h-[180px] flex-col rounded-sm bg-paper p-5 shadow-sm ring-1 ring-forest/5"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#1A362B]">
                  Year {i + 1} — {s.year}
                </p>
                <p className="mt-3 font-display text-lg text-gray-900">{s.focus}</p>
                <p className="mt-2 text-xs leading-relaxed text-graphite/70">{s.note}</p>
              </div>
            ))}
          </div>
          <Link
            href="/curriculum"
            className="mt-8 inline-block font-mono text-xs uppercase tracking-[0.15em] text-[#1A362B] underline decoration-gold underline-offset-4"
          >
            See the full curriculum →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="rounded-sm bg-forest px-6 py-10 text-center sm:px-8 md:px-16 md:py-12">
          <h2 className="font-display text-xl font-medium text-paper sm:text-2xl md:text-3xl">
            Want to join GEA?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-paper/70 sm:text-base">
            If you&apos;d like to apply to the academy itself, use the official Google Form below.
            Student leadership roles are still listed separately on the leadership page.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={academyApplicationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-sm bg-[#C8963E] px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-gray-900 transition hover:bg-goldlight"
            >
              Apply to GEA
            </Link>
            <Link
              href="/leadership"
              className="inline-flex items-center justify-center rounded-sm border border-paper/30 px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-paper transition hover:border-gold hover:text-gold"
            >
              View Leadership Roles
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
