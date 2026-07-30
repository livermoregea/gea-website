import Link from "next/link";
import HomeHeroCarousel from "@/components/HomeHeroCarousel";
import { SocialIcon, socialLinks } from "@/components/SocialIcons";

const benefits = [
  {
    label: "Cohort Model",
    body: "Because every student takes the PLTW engineering pathway, there is a much higher chance of staying with the same classmates for all four years while building support and mentorship over time.",
  },
  {
    label: "Industry Tools",
    body: "Students work in the same tools used by real engineers: Onshape in 9th grade, VEX V5 / VEXcode VR in 10th grade, and Revit in 11th grade, rather than watered-down classroom versions.",
  },
  {
    label: "Real Partners",
    body: "Field trips, guest engineers, and mentorships connect coursework to actual sustainability and manufacturing work happening right now.",
  },
  {
    label: "College-Ready Rigor",
    body: "GEA does not restrict students from taking AP or honors classes. Every course is UC/CSU approved, and students can still build a full college-prep schedule alongside PLTW engineering credit.",
  },
];

const sequence = [
  { year: "Freshman", focus: "Intro to Engineering Design", note: "Foundations in drafting, design thinking, and Onshape modeling." },
  { year: "Sophomore", focus: "Principles of Engineering", note: "Mechanisms, energy, and VEX V5 / VEXcode VR coding." },
  { year: "Junior", focus: "Civil Engineering & Architecture", note: "Structural design and Revit, honors-weighted." },
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
          Join the Academy Now!
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
          <h2 className="font-display text-2xl font-medium text-gray-900 sm:text-3xl md:text-5xl">
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
              <p className="mt-2 text-base leading-relaxed text-graphite/80">{b.body}</p>
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
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-graphite/75 sm:text-lg">
            Every GEA student takes the PLTW engineering pathway alongside their other classes, so
            there is a strong chance of staying together as a cohort for all four years. Students
            can still enroll in AP and honors courses and build a full college-prep schedule.
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
                <p className="mt-2 text-sm leading-relaxed text-graphite/70">{s.note}</p>
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
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-paper/75 sm:text-lg">
            If you&apos;d like to apply to the academy itself, use the official Google Form below.
            Student leadership roles are listed separately, and more general questions can be
            found on the Q&amp;A page.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
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
              View Leadership
            </Link>
            <Link
              href="/qa"
              className="inline-flex items-center justify-center rounded-sm border border-paper/30 px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-paper transition hover:border-gold hover:text-gold"
            >
              Q&amp;A
            </Link>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-sm border border-paper/12 bg-paper/5 px-5 py-5 text-left text-paper/75">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/45">
                Transfer and enrollment
              </p>
              <p className="mt-2 text-sm leading-relaxed sm:text-base">
                If you need transfer information, use the LVJUSD enrollment page for the latest
                details.
              </p>
              <Link
                href="https://www.livermoreschools.org/departments/educational-services/student-services/enrollment-transfers"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-paper/85 underline decoration-paper/30 underline-offset-4 transition hover:text-paper"
              >
                Open transfer page
              </Link>
            </div>

            <div className="rounded-sm border border-paper/12 bg-paper/5 px-5 py-5 text-left text-paper/75">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/45">
                Questions
              </p>
              <p className="mt-2 text-sm leading-relaxed sm:text-base">
                Contact your academic counselor or the GEA coordinators:
              </p>
              <div className="mt-3 space-y-1 text-sm sm:text-base">
                <p>
                  Karen Fletcher:{" "}
                  <a
                    href="mailto:kfletcher@lvjusd.org"
                    className="text-paper underline decoration-paper/30 underline-offset-4"
                  >
                    kfletcher@lvjusd.org
                  </a>
                </p>
                <p>
                  Dorothy Morallos:{" "}
                  <a
                    href="mailto:dmorallos@lvjusd.org"
                    className="text-paper underline decoration-paper/30 underline-offset-4"
                  >
                    dmorallos@lvjusd.org
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50">
              Follow GEA
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {socialLinks.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-paper/20 bg-paper/5 text-paper/90 transition hover:border-gold hover:text-gold"
                  aria-label={social.label}
                  title={social.label}
                >
                  <SocialIcon icon={social.icon} className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
