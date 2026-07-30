import Link from "next/link";

const resources = [
  {
    title: "GEA Overview",
    body: "A quick refresher on what the academy is, how the cohort works, and what students can expect.",
    href: "/qa",
    label: "Read FAQs",
  },
  {
    title: "Q&A Hub",
    body: "Use the unified Q&A hub to ask, answer, and review your history in one place.",
    href: "/qa",
    label: "Open Q&A Hub",
  },
  {
    title: "Academy Application",
    body: "For students who want to join the academy itself, the official application is on Google Forms.",
    href: "https://docs.google.com/forms/d/e/1FAIpQLSdTDKvYr0IqeTOAl88It9BlaFNkUU359dHG5B6FBzN48W6yng/viewform",
    label: "Apply to GEA",
    external: true,
  },
  {
    title: "Curriculum",
    body: "Review the four-year pathway and see how the engineering sequence fits into a full schedule.",
    href: "/curriculum",
    label: "View Curriculum",
  },
];

export default function StudentResourcesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">GEA Students</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl md:text-4xl">
        Student resources
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-graphite/80 sm:text-base">
        This page pulls together the main places GEA students may need, whether they&apos;re looking
        for the public FAQs, the private forum, or the academy application.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {resources.map((resource) => (
          <div key={resource.title} className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
            <h2 className="font-display text-lg text-forest">{resource.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-graphite/70">{resource.body}</p>
            <Link
              href={resource.href}
              target={resource.external ? "_blank" : undefined}
              rel={resource.external ? "noreferrer" : undefined}
              className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-forest px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-gold"
            >
              {resource.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
