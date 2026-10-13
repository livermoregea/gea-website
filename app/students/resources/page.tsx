import Link from "next/link";

const resources = [
  {
    title: "GEA Overview",
    body: "A quick refresher on the academy, how the cohort works, and what students can expect.",
    href: "/qa",
    label: "Read FAQs",
  },
  {
    title: "Q&A Hub",
    body: "GEA forum and student questions.",
    href: "/qa",
    label: "Open Q&A Hub",
  },
  {
    title: "Academy Admissions",
    body: "Academy applications open in late November. Contact GEA with questions about the program.",
    href: "/contact",
    label: "Contact GEA",
    external: false,
  },
  {
    title: "Curriculum",
    body: "See the four-year pathway and how the engineering sequence fits into a full schedule.",
    href: "/curriculum",
    label: "View Curriculum",
  },
];

export default function StudentResourcesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">GEA Students</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl md:text-4xl">
        Student resources
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-graphite/80 sm:text-base">
        Main GEA links for students.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {resources.map((resource) => (
          <div key={resource.title} className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
            <h2 className="font-display text-lg text-forest">{resource.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-graphite/80">{resource.body}</p>
            <Link
              href={resource.href}
              target={resource.external ? "_blank" : undefined}
              rel={resource.external ? "noreferrer" : undefined}
              className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-accent"
            >
              {resource.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
