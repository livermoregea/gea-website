import Image from "next/image";
import ROPSection from "@/components/ROPSection";

const years = [
  {
    grade: "9th Grade",
    core: ["Conceptual Physics or Biology", "Algebra 1 or higher math", "English 9", "Social Science 9", "PLTW Introduction to Engineering Design"],
  },
  {
    grade: "10th Grade",
    core: ["Biology or Chemistry", "Geometry or higher math", "English 10", "World History", "PLTW Principles of Engineering, Honors"],
  },
  {
    grade: "11th Grade",
    core: ["Chemistry or Physics", "Algebra 2", "English 11", "US History", "PLTW Civil Engineering & Architecture, Honors"],
  },
  {
    grade: "12th Grade",
    core: ["AP Environmental Science or other science", "Precalculus, Calculus, or Statistics", "English 12", "Economics/Civics", "PLTW Engineering Capstone, Honors"],
  },
];

export default function CurriculumPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-forest">Academics</p>
          <h1 className="mt-4 font-display text-3xl font-medium text-forestdeep sm:text-4xl md:text-5xl">
            The GEA curriculum
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-graphite/80 sm:text-base">
            GEA is a California Partnership Academy that blends hands-on engineering coursework into a
            standard, UC/CSU-approved college-prep schedule. Academic classes connect to green
            technology, sustainability, and environmental themes, while Career Technical Education
            courses follow the Project Lead the Way (PLTW) engineering curriculum.
          </p>

        </div>
        <figure className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-forest/10">
          <div className="relative aspect-[4/3]">
            <Image src="/images/homepage/IMG_6218.JPG" alt="A GEA student developing a CAD model in the engineering classroom" fill priority sizes="(min-width: 1024px) 550px, 100vw" className="object-cover" />
          </div>
          <figcaption className="px-5 py-4 text-sm text-forest">Real tools. Room to experiment. A pathway to keep growing.</figcaption>
        </figure>
      </div>

      <div className="dim-divider my-12" />

      <div className="grid gap-6 md:grid-cols-2">
        {years.map((y, i) => (
          <div key={y.grade} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-forest/10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">
              Cohort Year {i + 1}
            </p>
            <h2 className="mt-2 font-display text-xl text-forest">{y.grade}</h2>
            <ul className="mt-4 space-y-2">
              {y.core.map((c) => (
                <li key={c} className="flex gap-3 text-sm text-graphite/80">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <ROPSection className="mt-12 md:mt-16" />

      <div className="mt-12 grid gap-6 rounded-sm bg-forest p-6 text-paper sm:p-8 md:mt-16 md:grid-cols-3 md:p-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">Software & Tools</p>
          <p className="mt-2 text-sm text-paper/85">
            CAD modeling, structural analysis tools, and PLTW software give students hands-on
            experience with the tools professional engineers use.
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">Electives Still Fit</p>
          <p className="mt-2 text-sm text-paper/85">
            Students can still choose from LHS electives like band, orchestra, world languages, and
            more alongside their GEA cohort courses.
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-forest">No GPA Gate</p>
          <p className="mt-2 text-sm text-paper/85">
            Every freshman starts on equal footing. Interest and willingness to engage matter more
            than a prior track record.
          </p>
        </div>
      </div>
    </div>
  );
}
