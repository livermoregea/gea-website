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
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Academics</p>
      <h1 className="mt-4 font-display text-2xl font-medium text-forest sm:text-3xl md:text-4xl">
        The GEA curriculum
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-graphite/80 sm:text-base">
        GEA is a California Partnership Academy that blends hands-on engineering coursework into a
        standard, UC/CSU-approved college-prep schedule. Academic classes connect to green
        technology, sustainability, and environmental themes, while Career Technical Education
        courses follow the Project Lead the Way (PLTW) engineering curriculum.
      </p>

      <div className="dim-divider my-12" />

      <div className="grid gap-6 md:grid-cols-2">
        {years.map((y, i) => (
          <div key={y.grade} className="rounded-sm bg-forest/[0.03] p-6 ring-1 ring-forest/5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
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

      <div className="mt-12 grid gap-6 rounded-sm bg-forest p-6 text-paper sm:p-8 md:mt-16 md:grid-cols-3 md:p-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Software & Tools</p>
          <p className="mt-2 text-sm text-paper/70">
            CAD modeling, structural analysis tools, and PLTW software give students hands-on
            experience with the tools professional engineers use.
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">Electives Still Fit</p>
          <p className="mt-2 text-sm text-paper/70">
            Students can still choose from LHS electives like band, orchestra, world languages, and
            more alongside their GEA cohort courses.
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-gold">No GPA Gate</p>
          <p className="mt-2 text-sm text-paper/70">
            Every freshman starts on equal footing. Interest and willingness to engage matter more
            than a prior track record.
          </p>
        </div>
      </div>
    </div>
  );
}
