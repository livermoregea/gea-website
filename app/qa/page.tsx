import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const revalidate = 0;

const academyApplicationUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSdTDKvYr0IqeTOAl88It9BlaFNkUU359dHG5B6FBzN48W6yng/viewform";

const faqs = [
  {
    question: "What is the Green Engineering Academy?",
    answer:
      "GEA is a four-year academy at Livermore High School. Students move through a shared engineering pathway together while building design, sustainability, and problem-solving skills.",
  },
  {
    question: "What does 'green engineering' mean?",
    answer:
      "It means learning engineering with an emphasis on sustainability, energy, materials, and responsible problem-solving.",
  },
  {
    question: "Do I have to want to become an engineer?",
    answer:
      "Not at all. Many students join for hands-on learning, teamwork, project management, and technical skills that help in many careers.",
  },
  {
    question: "Can I still take electives outside of GEA?",
    answer:
      "Yes. GEA students can still take electives like band, orchestra, world languages, and other classes that fit their schedule.",
  },
  {
    question: "Can I take AP classes too?",
    answer:
      "Yes. Students can take AP courses offered at LHS, and in some cases AP classes can replace the GEA-equivalent course in a pathway.",
  },
  {
    question: "Is there a GPA requirement to get in?",
    answer:
      "There is not a strict GPA gate. Interest, effort, and willingness to work in the program matter most.",
  },
  {
    question: "Are all of my classes with the same students every day?",
    answer:
      "Not every class, but GEA students do share their core academy courses together as a cohort, which helps build community over four years.",
  },
  {
    question: "Can I join later or leave if it is not the right fit?",
    answer:
      "Students are encouraged to join as freshmen, but if space is available they may join later. If the academy is not the right fit, students can also withdraw.",
  },
  {
    question: "What makes GEA different from a normal class?",
    answer:
      "GEA combines cohort support, project-based learning, real engineering tools, field trips, guest speakers, and connections to careers and college pathways.",
  },
  {
    question: "What are the benefits of being a California Partnership Academy?",
    answer:
      "The academy receives support for equipment, field experiences, and industry connections that help students learn with real tools and real-world context.",
  },
];

export default async function QAPage() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard#qa");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <div className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Q&amp;A</p>
        <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl md:text-4xl">
          GEA questions and answers
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-graphite/80 sm:text-base">
          Start here for the most common questions about GEA. If you want to ask a question or
          keep track of replies, log in to use the student dashboard.
        </p>
      </div>

      <div className="mt-10 rounded-sm bg-forest/[0.03] px-5 py-6 ring-1 ring-forest/5 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
              Helpful links
            </p>
            <p className="mt-2 text-sm leading-relaxed text-graphite/70 sm:text-base">
              Use the application link if you&apos;re ready to join, or sign in to use the forum
              and keep your Q&amp;A activity in one place.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={academyApplicationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold transition hover:bg-forestdeep"
            >
              Open Application Form
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest transition hover:bg-forest/[0.03]"
            >
              Open Forum
            </Link>
          </div>
        </div>
      </div>

      <div className="dim-divider my-12" />

      <section className="max-w-4xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">FAQ</p>
            <h2 className="mt-2 font-display text-xl font-medium text-forest sm:text-2xl">
              Frequently asked questions
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-graphite/60">
            The questions below cover the basics. If you need a deeper answer, the forum is the
            best place to ask and follow up.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              className="group rounded-sm border border-forest/10 bg-paper/80 shadow-[0_8px_24px_rgba(18,53,36,0.04)]"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 font-medium text-forest marker:hidden sm:px-6 sm:py-5">
                <span className="text-sm leading-relaxed sm:text-base">{faq.question}</span>
                <span className="mt-0.5 text-lg leading-none text-gold transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 text-sm leading-relaxed text-graphite/75 sm:px-6 sm:text-base">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
