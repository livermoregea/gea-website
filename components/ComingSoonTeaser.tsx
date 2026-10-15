import Link from "next/link";

export default function ComingSoonTeaser() {
  return (
    <section aria-labelledby="coming-soon-heading" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 md:pb-16">
      <div className="relative overflow-hidden rounded-3xl border border-gold/35 bg-[#EEE5C7] p-6 sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border-[36px] border-gold/15" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="inline-flex rounded-full bg-forest px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-goldlight">Coming soon to GEA</p>
            <h2 id="coming-soon-heading" className="mt-5 max-w-xl font-display text-3xl font-medium leading-tight text-forestdeep sm:text-5xl">Something new is coming.<br/>Bring your curiosity.</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-graphite/85">A new chapter is taking shape. We’re keeping the details under wraps for now—GEA and LVJUSD students can create a GEA One account and get ready for what’s next.</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/login?mode=signup#student-account" className="inline-flex min-h-11 items-center justify-center rounded-full bg-forest px-6 py-3 text-sm font-medium text-paper transition hover:bg-forestdeep focus-visible:outline-forest">Create GEA One account <span aria-hidden="true" className="ml-3">→</span></Link>
              <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline underline-offset-4 focus-visible:outline-forest">Already have GEA One? Sign in</Link>
            </div>
            <p className="mt-3 text-sm text-forest">GEA and LVJUSD students only · Use your @lvjusd.org student email.</p>
          </div>
          <div className="flex flex-col items-start gap-5 lg:items-center">
            <div aria-hidden="true" className="relative flex h-36 w-36 max-w-full items-center justify-center rounded-full bg-forestdeep text-goldlight shadow-lg shadow-forest/10 sm:h-44 sm:w-44">
              <span className="font-display text-7xl sm:text-8xl">?</span>
              <span className="absolute -bottom-2 -right-3 rotate-6 rounded-full bg-goldlight px-4 py-2 text-xs font-medium text-forestdeep">Under wraps</span>
            </div>
            <ul className="space-y-3 text-sm font-medium text-forest">
              <li>Stay curious.</li>
              <li>Think beyond the classroom.</li>
              <li>Be ready for what’s next.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
