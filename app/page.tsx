import { GEA_DONATION_URL } from "@/lib/donations";
import Link from "next/link";
import AcademyPhotoGallery from "@/components/AcademyPhotoGallery";
import CommunityProjectCards from "@/components/CommunityProjectCards";
import HomeHighlights from "@/components/HomeHighlights";
import HomeHeroCarousel from "@/components/HomeHeroCarousel";
import ROPSection from "@/components/ROPSection";

const benefits = [
  {
    label: "Cohort Model",
    body: "Every student follows the PLTW engineering pathway, so your core classes stay with the same group for much of high school. That consistency builds support, familiarity, and mentorship over time.",
  },
  {
    label: "Industry Tools",
    body: "Students use the same tools engineers use in the field: Onshape in 9th grade, VEX V5 and VEXcode VR in 10th grade, and Revit in 11th grade.",
  },
  {
    label: "Real Partners",
    body: "Field trips, guest engineers, and mentorships connect classwork to sustainability and manufacturing work happening right now.",
  },
  {
    label: "College-Ready Rigor",
    body: "GEA doesn’t block AP or honors classes. Every course is UC/CSU approved, so students can still build a full college-prep schedule alongside PLTW engineering credit.",
  },
];

const sequence = [
  { year: "Freshman", focus: "Intro to Engineering Design", note: "Foundations in drafting, design thinking, and Onshape modeling." },
  { year: "Sophomore", focus: "Principles of Engineering", note: "Mechanisms, energy, and VEX V5 / VEXcode VR coding." },
  { year: "Junior", focus: "Civil Engineering & Architecture", note: "Structural design and Revit, honors-weighted." },
  { year: "Senior", focus: "Engineering Capstone", note: "An independent, portfolio-defining project from concept to presentation." },
];

function HeroCopy() {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/90">
        LHS Green Engineering Academy · Est. 2010
      </p>
      <h1 className="mt-5 max-w-3xl font-display text-3xl font-medium leading-[1.08] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)] sm:text-4xl md:mt-6 md:text-6xl">
        Curiosity today.
        Engineering tomorrow.
      </h1>
      <p className="mt-5 max-w-xl text-sm leading-relaxed text-gray-200 drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)] sm:text-base md:mt-6 md:text-lg">
        At Livermore High School’s Green Engineering Academy, students turn ideas into designs,
        learn professional tools, and grow together through a four-year engineering pathway.
        Start with a question. See where it takes you.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
        <Link
          href="/curriculum"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-[#C8963E] px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-gray-900 transition hover:bg-goldlight sm:w-auto"
        >
          Explore the Curriculum
        </Link>
      </div>
      </div>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative flex min-h-[560px] sm:min-h-[620px] lg:min-h-[680px] w-full flex-col justify-center overflow-hidden bg-forest">
        <div className="absolute inset-0">
          <HomeHeroCarousel />
        </div>
        <div className="pointer-events-none relative z-10 container mx-auto px-6 py-16 md:px-12">
          <div className="pointer-events-auto max-w-3xl">
            <HeroCopy />
          </div>
        </div>
      </section>
      <HomeHighlights />

      <AcademyPhotoGallery />

      <section aria-labelledby="academy-difference-heading" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 md:pb-16">
        <div className="grid gap-8 rounded-3xl bg-forestdeep bg-blueprintgrid bg-grid p-6 text-paper sm:p-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:pr-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-goldlight">The academy difference</p>
            <h2 id="academy-difference-heading" className="mt-4 font-display text-3xl leading-tight sm:text-4xl">A place to learn.<br/>A team to grow with.</h2>
            <p className="mt-5 text-base leading-relaxed text-paper/85">Engineering is part of your whole high school experience—from the people beside you to the tools in your hands.</p>
            <Link href="/curriculum" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-goldlight px-5 py-3 text-sm font-medium text-forestdeep transition hover:bg-paper">Get to know the pathway <span aria-hidden="true" className="ml-3">→</span></Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {benefits.map(b => (
              <div key={b.label} className="border-t border-paper/20 pt-4">
                <h3 className="font-display text-xl text-goldlight">{b.label}</h3>
                <p className="mt-3 text-sm leading-relaxed text-paper/85">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Course Sequence */}
      <section className="bg-gold/[0.08] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-xl font-medium text-forestdeep sm:text-3xl md:text-4xl">
            A four-year pathway, one cohort
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-graphite/80 sm:text-lg">
            Every GEA student takes the PLTW engineering pathway alongside their other classes.
            That keeps the cohort together for four years while leaving room for AP, honors, and a
            full college-prep schedule.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-4 md:gap-6">
            {sequence.map((s, i) => (
              <div
                key={s.year}
                className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-forest/10"
              >
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#1A362B]">
                  {s.year} · Year {i + 1}
                </p>
                <p className="mt-3 font-display text-lg text-gray-900">{s.focus}</p>
                <p className="mt-2 text-sm leading-relaxed text-graphite/80">{s.note}</p>
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

      <ROPSection className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 md:pt-16" />

      <section aria-labelledby="community-heading" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 md:pt-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest/80">Beyond the classroom</p>
        <h2 id="community-heading" className="mt-3 font-display text-3xl font-medium text-forestdeep sm:text-4xl">Community In Action</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-graphite/80">Sharing engineering through hands-on projects with our community.</p>
        <div className="dim-divider mt-6" />
        <CommunityProjectCards />
        <Link href="/community" className="mt-8 inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest underline decoration-gold underline-offset-4 transition hover:text-forestdeep">
          Explore Community In Action <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      </section>

      <section aria-labelledby="support-gea-heading" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 md:pt-16">
        <div className="flex flex-col gap-6 rounded-sm border border-forest/10 bg-paper p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest/80">Give to GEA</p>
            <h2 id="support-gea-heading" className="mt-3 font-display text-2xl text-forest sm:text-3xl">Support Green Engineering Academy</h2>
            <p className="mt-3 text-sm leading-relaxed text-graphite/80 sm:text-base">
              Want to support GEA? Families, alumni, and community members can donate through the LVJUSD online store.
              Thank you for supporting our academy.
            </p>
          </div>
          <a href={GEA_DONATION_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm bg-forest px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-accent transition hover:bg-forestdeep">
            Donate to GEA<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </section>

      <section aria-labelledby="admissions-heading" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
        <div className="flex flex-col gap-5 rounded-xl border border-forest/15 bg-forest/[0.04] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h2 id="admissions-heading" className="font-display text-xl text-forestdeep sm:text-2xl">Interested in GEA?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite/80"><strong className="font-semibold text-forest">Applications open in late November.</strong> Have questions about the program? Get in touch.</p>
          </div>
          <Link href="/contact" className="inline-flex min-h-11 w-fit shrink-0 items-center justify-center rounded-full bg-forest px-5 py-3 text-sm font-medium text-paper transition hover:bg-forestdeep focus-visible:outline-forest">Ask a question <span aria-hidden="true" className="ml-3">→</span></Link>
        </div>
      </section>
    </div>
  );
}
