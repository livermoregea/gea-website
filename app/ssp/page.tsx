import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SSPChallenge from "@/components/SSPChallenge";
import { SocialIcon } from "@/components/SocialIcons";

export const metadata: Metadata = {
  title: "Science at Stockmens Park 2026",
  description:
    "Look back at Science at Stockmens Park 2026 with Green Engineering Academy, and revisit the earthquake engineering activity, materials, and instructions.",
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
      <section className="relative isolate flex min-h-[440px] items-center overflow-hidden border-b border-gold/25 bg-[#181818] text-paper sm:min-h-[560px]">
        <div aria-hidden="true" className="ssp-hero-video pointer-events-none absolute inset-0 select-none">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/ssp/headervideo/poster.jpg"
            className="h-full w-full object-cover"
            tabIndex={-1}
            disablePictureInPicture
            disableRemotePlayback
          >
            <source src="/images/ssp/headervideo/header.mp4" type="video/mp4" />
          </video>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#181818]/85 via-[#181818]/70 to-[#181818]/55" />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Link href="/community" className="mb-5 inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-paper/75 transition hover:text-goldlight"><span aria-hidden="true" className="mr-2">←</span> Community In Action</Link>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-goldlight">Community outreach · Looking back at 2026</p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="block">Science at</span>
            <span className="block">Stockmens Park 2026</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/85 sm:mt-6 sm:text-lg">A look back at bringing hands-on earthquake engineering to our community, one spaghetti structure at a time.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="#event-reflection" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-gold px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-forestdeep transition hover:bg-goldlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-goldlight">Look back at the event ↓</a>
            <a href="#activity-resources" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-paper/35 px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-paper transition hover:border-goldlight hover:text-goldlight">Activity materials & instructions ↓</a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:space-y-16 sm:px-6 sm:py-20">
        <section id="event-reflection" aria-labelledby="reflection-heading" className="scroll-mt-28">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">From the park · 2026</p>
              <h2 id="reflection-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Engineering beyond the classroom</h2>
              <p className="mt-5 leading-relaxed text-graphite/80">At Science at Stockmens Park, GEA brought earthquake engineering out of the classroom and into a hands-on community activity. The challenge began with a simple question: can you build a structure that survives shaking?</p>
              <p className="mt-4 leading-relaxed text-graphite/80">Spaghetti, marshmallows, and tape turned that question into something to build and test. The activity connected seismic waves with structural design, giving visitors a way to explore engineering through their own ideas.</p>
              <p className="mt-4 leading-relaxed text-graphite/80">The point of the challenge was more than keeping a tower standing. It was a chance to observe what happened, talk through why, and consider what to change in the next design.</p>
            </div>
            <figure className="overflow-hidden rounded-sm border border-forest/15 bg-white/70">
              <Image src="/images/ssp/headervideo/poster.jpg" width={1920} height={1080} sizes="(min-width: 1024px) 540px, 100vw" alt="GEA students and community visitors gathered around the science activity at Stockmens Park" className="aspect-[4/3] w-full object-cover" />
              <figcaption className="px-5 py-4 text-sm leading-relaxed text-graphite/70">A moment from the Science at Stockmens Park 2026 timelapse.</figcaption>
            </figure>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Build", "A 10-minute design challenge with everyday materials made structural engineering tangible."],
              ["Test", "A skateboard shake table connected the design challenge to the motion of an earthquake."],
              ["Reflect", "The shake-test report invited teams to explain their observations and propose a design improvement."],
            ].map(([title, description]) => (
              <article key={title} className="rounded-sm border border-forest/15 bg-white/70 p-6">
                <h3 className="font-display text-2xl text-forestdeep">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-graphite/75">{description}</p>
              </article>
            ))}
          </div>
          <a href="https://www.instagram.com/lhsgea/" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-3 text-sm font-medium text-forest underline underline-offset-4">
            <SocialIcon icon="instagram" className="h-5 w-5" />
            Follow more of GEA&apos;s community projects @lhsgea ↗
          </a>
        </section>

        <section id="activity-resources" aria-labelledby="resources-heading" className="scroll-mt-28 rounded-sm border border-gold/30 bg-gold/[0.06] p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">Keep exploring</p>
          <h2 id="resources-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Try the activity yourself</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-graphite/80">The event may be behind us, but the learning can continue. The original activity video, science explanations, supply list, building steps, timer, and shake-test report are all here to revisit.</p>
          <nav aria-label="Activity resources" className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-forest">
            <a href="#video-instructions" className="inline-flex min-h-11 items-center underline underline-offset-4">Instruction video ↓</a>
            <a href="#written-instructions" className="inline-flex min-h-11 items-center underline underline-offset-4">Seismic wave science ↓</a>
            <a href="#challenge" className="inline-flex min-h-11 items-center underline underline-offset-4">Materials &amp; building steps ↓</a>
          </nav>
        </section>

        <section id="video-instructions" aria-labelledby="video-heading" className="scroll-mt-28">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">Activity resources · Video</p>
          <h2 id="video-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">The original activity instructions</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-graphite/80">Revisit the instruction video from the event, or use it to try the challenge with your own group. The written science explanations and building steps are below, too.</p>
          <div className="mt-6 aspect-video w-full overflow-hidden rounded-sm border border-forest/20 bg-forestdeep">
            <iframe
              src="https://www.youtube-nocookie.com/embed/fVFe5nQ5TMs"
              title="Science at Stockmens Park activity instructions"
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <p className="mt-3 text-sm text-graphite/80"><a href="https://youtu.be/fVFe5nQ5TMs" target="_blank" rel="noopener noreferrer" className="text-forest underline underline-offset-4">Watch on YouTube ↗</a></p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="#written-instructions" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-gold px-5 py-3 text-sm font-medium text-forestdeep hover:bg-goldlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">Read the science & instructions ↓</a>
            <a href="#challenge" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-forest/25 px-5 py-3 text-sm font-medium text-forestdeep hover:bg-forest/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">Go to the building steps ↓</a>
          </div>
        </section>

        <section id="written-instructions" aria-labelledby="waves-heading" className="scroll-mt-28">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">Activity resources · The science</p>
          <h2 id="waves-heading" className="mt-3 font-display text-3xl text-forestdeep sm:text-4xl">Four types of seismic waves</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-graphite/80">Earthquakes send energy through the Earth and along its surface. These four wave types formed the science behind our challenge.</p>
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
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">Activity resources · The engineering challenge</p>
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

        <div className="border-t border-forest/15 pt-8">
          <Link href="/community" className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.15em] text-forest underline decoration-gold underline-offset-4">
            <span aria-hidden="true" className="mr-2">←</span> Explore Community In Action
          </Link>
        </div>
      </div>
    </div>
  );
}
