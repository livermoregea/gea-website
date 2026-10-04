import Image from "next/image";
import Link from "next/link";

const projects = [
  {
    href: "/ssp",
    title: "Science at Stockmens Park 2026",
    category: "Community outreach",
    year: "2026",
    image: "/images/ssp/headervideo/poster.jpg",
    imageAlt: "GEA students sharing a hands-on science activity with visitors at Stockmens Park",
    description: "Look back at our hands-on earthquake engineering outreach, and revisit the activity materials and instructions.",
  },
];

export default function CommunityProjectCards() {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      {projects.map((project) => (
        <Link key={project.href} href={project.href} className="group flex h-full flex-col overflow-hidden rounded-sm border border-forest/15 bg-white/70 transition hover:border-forest/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
          <div className="relative aspect-[16/10] overflow-hidden">
            <Image
              src={project.image}
              alt={project.imageAlt}
              fill
              sizes="(min-width: 1200px) 360px, (min-width: 768px) 33vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex flex-1 flex-col p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-forest/65">{project.category} · {project.year}</p>
            <h3 className="mt-3 font-display text-2xl leading-tight text-forestdeep">{project.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-graphite/75">{project.description}</p>
            <span className="mt-auto pt-6 font-mono text-xs uppercase tracking-[0.15em] text-forest">Explore the project <span aria-hidden="true">→</span></span>
          </div>
        </Link>
      ))}
      {Array.from({ length: Math.max(0, 3 - projects.length) }, (_, slot) => (
        <div key={slot} aria-label="Future community project" className="flex min-h-[340px] flex-col overflow-hidden rounded-sm border border-dashed border-forest/20 bg-forest/[0.02]">
          <div aria-hidden="true" className="aspect-[16/10] border-b border-dashed border-forest/10 bg-blueprintgrid bg-grid opacity-40" />
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-forest/45">Coming soon</p>
          </div>
        </div>
      ))}
    </div>
  );
}
