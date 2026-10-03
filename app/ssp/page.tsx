import type { Metadata } from "next";
import Image from "next/image";
import SSPChallenge from "@/components/SSPChallenge";

export const metadata: Metadata = {
  title: "Science at Stockmens Park",
  description:
    "Explore seismic waves and take on a 10-minute earthquake engineering challenge with Green Engineering Academy at Stockmens Park.",
};

const materials = [
  ["12", "spaghetti noodles"],
  ["", "Tape"],
  ["24", "mini marshmallows"],
];

const waves = [
  { name: "Primary (P) waves", type: "Body wave", description: "Push and pull the ground in the direction the wave travels. These are the first waves to arrive." },
  { name: "Secondary (S) waves", type: "Body wave", description: "Move the ground perpendicular to the direction the wave travels. They arrive after P waves." },
  { name: "Love waves", type: "Surface wave", description: "Move the ground from side to side horizontally, perpendicular to the direction the wave travels." },
  { name: "Rayleigh waves", type: "Surface wave", description: "Move the ground in a rolling motion, both up and down and forward and backward." },
];

export default function ScienceAtStockmensParkPage() {
  return (
    <div className="bg-paper">
      <section className="border-b border-gold/25 bg-forestdeep bg-blueprintgrid bg-grid text-paper">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-goldlight">Green Engineering Academy · Hands-on science</p>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-medium leading-tight sm:text-6xl">Science at Stockmens Park</h1>
          <p className="mt-4 max-w-2xl text-base sm:mt-6 sm:text-lg leading-relaxed text-paper/85">Can you build a structure that survives an earthquake? Explore the waves that shake the ground, then put your engineering skills to the test.</p>
          <a href="#video-instructions" className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-gold px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-forestdeep transition hover:bg-goldlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-goldlight">Video & instructions ↓</a>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:space-y-16 sm:px-6 sm:py-20">
        <section id="video-instructions" aria-labelledby="video-heading" className="scroll-mt-28">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">Start here</p>
          <h2 id="video-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Watch the instructions</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-graphite/80">Watch our video to see how the activity works, then scroll down to explore the science and follow the steps. Prefer reading? The written instructions are below, too.</p>
          {/* Replace this placeholder with a responsive YouTube embed when the instruction video is ready. */}
          <div className="mt-6 flex aspect-video min-h-48 w-full flex-col items-center justify-center gap-3 rounded-sm border border-forest/20 bg-forestdeep px-5 py-6 text-center text-paper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-10 w-10 text-goldlight" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" /></svg>
            <p className="font-display text-xl sm:text-2xl">Instruction video coming soon</p>
            <p className="max-w-sm text-sm leading-relaxed text-paper/80">Our YouTube video will appear here. For now, follow the written guide below.</p>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="#written-instructions" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-gold px-5 py-3 text-sm font-medium text-forestdeep hover:bg-goldlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">Read the science & instructions ↓</a>
            <a href="#challenge" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/25 px-5 py-3 text-sm font-medium text-forestdeep hover:bg-forest/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">Go to the building steps ↓</a>
          </div>
        </section>

        <section id="written-instructions" aria-labelledby="waves-heading" className="scroll-mt-28">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">The science</p>
          <h2 id="waves-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Four types of seismic waves</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-graphite/80">Earthquakes send energy through the Earth and along its surface. Meet the four wave types we’re exploring today.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {waves.map((wave) => (
              <article key={wave.name} className="rounded-sm border border-forest/15 bg-white/70 p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-forest/70">{wave.type}</p>
                <h3 className="mt-2 font-display text-xl text-forestdeep">{wave.name}</h3>
                <p className="mt-3 leading-relaxed text-graphite/80">{wave.description}</p>
              </article>
            ))}
          </div>
          <figure className="mt-6 rounded-sm border border-forest/15 bg-white p-3 sm:p-8">
            <Image src="/images/ssp/love-wave.svg" width={800} height={520} alt="Love wave viewed from above: the wave travels to the right while colorful patches of ground move side to side across its path, without bouncing up and down." className="mx-auto h-auto w-full max-w-3xl" />
            <figcaption className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-graphite/75">Love waves shake the ground sideways. Imagine looking down from the sky: the blue arrow shows where the wave goes, and the green arrow shows how the ground wiggles. Illustration by GEA, based on the <a className="text-forest underline underline-offset-4" href="https://www.iris.edu/hq/inclass/animation/lovewave_motion">IRIS Love wave explanation</a>.</figcaption>
          </figure>
        </section>

        <section id="challenge" aria-labelledby="challenge-heading" className="scroll-mt-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">The engineering challenge</p>
              <h2 id="challenge-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Build it. Shake it. Test it.</h2>
            </div>
            <p className="rounded-sm border border-gold/40 bg-gold/10 px-5 py-3 font-mono text-sm text-forestdeep">Build time: <strong>10 minutes</strong></p>
          </div>
          <h3 className="mt-8 font-display text-2xl text-forestdeep">Your materials</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map(([quantity, material]) => (
              <li key={material} className="flex items-center gap-4 rounded-sm border border-forest/15 bg-white/70 p-5">
                {quantity && <span className="min-w-12 font-display text-2xl text-forest">{quantity}</span>}
                <span className="text-graphite/85">{material}</span>
              </li>
            ))}
          </ul>
          <SSPChallenge />
        </section>

        <section aria-labelledby="photos-heading">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">From the park</p>
          <h2 id="photos-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Science in action</h2>
          <p className="mt-4 text-graphite/80">Photos from our builds and shake-table tests will appear here.</p>
          {/* Replace these placeholders with event photos and descriptive alt text when available. */}
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {["Building together", "The shake-table test", "Our finished designs"].map((caption) => (
              <div key={caption} className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-forest/25 bg-forest/[0.03] px-5 text-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-9 w-9 text-forest/50" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="2" /><circle cx="8" cy="10" r="1.5" /><path d="m3 17 5-4 4 3 4-5 5 6" /></svg>
                <p className="font-display text-lg text-forestdeep">{caption}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-forest/65">Photos coming soon</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
