import { BUILDERS_ENABLED } from "@/lib/site-features";
import Image from "next/image";
import Link from "next/link";

const projects = [
  {
    href: "/builders",
    title: "GEA Builders",
    category: "Beyond class",
    image: "",
    imageAlt: "",
    description: "Notice a problem. Build a solution. Share what changed. Put your engineering skills to work at home, at school, or in your community.",
    action: "Find your next build",
  },
  {
    href: "/ssp",
    title: "Science at Stockmens Park",
    category: "Community outreach · 2026",
    image: "/images/ssp/headervideo/poster.jpg",
    imageAlt: "GEA students helping visitors explore science at the academy’s Stockmens Park booth",
    description: "Explore the earthquake engineering activity, revisit the materials, and see how GEA brings hands-on science into the community.",
    action: "Explore the activity",
  },
];

export default function CommunityProjectCards() {
  const visibleProjects = projects.filter(project => BUILDERS_ENABLED || project.href !== "/builders");
  const singleProject = visibleProjects.length === 1;
  return (
    <div className={`mt-8 grid gap-6 ${singleProject ? "" : "md:grid-cols-2"}`}>
      {visibleProjects.map(project => (
        <Link key={project.href} href={project.href} className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-forest/10 transition hover:shadow-lg hover:ring-forest/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest ${singleProject ? "md:flex-row" : ""}`}>
          <div className={`relative aspect-[16/10] overflow-hidden ${singleProject ? "md:w-1/2 md:shrink-0" : ""}`}>
            {project.image ? (
              <Image src={project.image} alt={project.imageAlt} fill sizes="(min-width: 1200px) 550px, (min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="relative flex h-full flex-col justify-between overflow-hidden bg-forestdeep bg-blueprintgrid bg-grid p-7 text-paper sm:p-9">
                <span className="relative z-10 w-fit rounded-full border border-goldlight/40 px-3 py-1 font-mono text-xs uppercase tracking-widest text-goldlight">GEA Builders</span>
                <span aria-hidden="true" className="absolute -right-8 -top-10 h-56 w-56 rounded-full border-[28px] border-gold/15" />
                <span className="relative z-10 font-display text-4xl leading-tight sm:text-5xl">Small builds.<br/><span className="text-goldlight">Real impact.</span></span>
                <span className="relative z-10 text-sm text-paper/85">Notice → Build → Share</span>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-6 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-forest">{project.category}</p>
            <h3 className="mt-3 font-display text-2xl leading-tight text-forestdeep sm:text-3xl">{project.title}</h3>
            <p className="mt-3 text-base leading-relaxed text-graphite/80">{project.description}</p>
            <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm font-medium text-forest">
              {project.action}<span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/5 transition group-hover:bg-forest group-hover:text-paper">→</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
