type ROPSectionProps = {
  className?: string;
};

export default function ROPSection({ className = "" }: ROPSectionProps) {
  return (
    <section aria-labelledby="rop-heading" className={className}>
      <div className="rounded-sm border border-gold/30 border-l-4 border-l-gold bg-gold/[0.06] p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest/65">Explore ROP</p>
        <h2 id="rop-heading" className="mt-3 max-w-3xl font-display text-2xl text-forestdeep sm:text-3xl">
          Don&apos;t live in the Livermore school district?
        </h2>
        <p className="mt-4 max-w-3xl leading-relaxed text-graphite/80">
          Discover Tri-Valley ROP (Regional Occupational Program), which offers hands-on career
          and technical education for high school students in Dublin Unified, Pleasanton Unified,
          and Livermore Valley Joint Unified. Students can explore classes at school sites beyond
          their own campus.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-graphite/75">
          Civil Engineering &amp; Architecture at Livermore High is offered as an ROP course.
          Ask your school&apos;s College &amp; Career Specialist about eligibility, course availability,
          and scheduling.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href="https://www.tvrop.org/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-forest px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-paper transition hover:bg-forestdeep">
            Learn more about ROP <span aria-hidden="true" className="ml-2">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a href="https://www.tvrop.org/students-parents/faqs" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/25 px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-forest transition hover:bg-forest/5">
            Eligibility &amp; registration <span aria-hidden="true" className="ml-2">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </section>
  );
}
