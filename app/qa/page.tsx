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
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Student Q&amp;A</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl md:text-4xl">
        GEA questions and answers
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-graphite/80 sm:text-base">
        Start here for the most common questions about GEA. If you want to ask a question or keep
        track of replies, log in to use the student dashboard.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Apply to GEA</p>
          <p className="mt-2 text-sm text-graphite/70">
            Ready to join the academy? Use the official Google Form.
          </p>
          <Link
            href={academyApplicationUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
          >
            Open Application Form
          </Link>
        </div>
        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">
            Want to Join the Forum?
          </p>
          <p className="mt-2 text-sm text-graphite/70">
            Log in to browse posts, comment on threads, and vote on replies.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex min-h-11 items-center rounded-sm border border-forest/15 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-forest"
          >
            Open Forum
          </Link>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-xl font-medium text-forest sm:text-2xl">
          GEA Frequently Asked Questions
        </h2>
        <div className="mt-6 space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={faq.question}
              className="group rounded-sm bg-forest/[0.03] ring-1 ring-forest/5"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-forest marker:hidden">
                <span className="text-sm sm:text-base">{faq.question}</span>
                <span className="text-xl leading-none text-gold transition group-open:rotate-45">+</span>
              </summary>
              <div className="px-5 pb-5 text-sm leading-relaxed text-graphite/75 sm:text-base">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
