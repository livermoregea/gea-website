import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mac & Cheese",
  description:
    "An easter egg recipe page for the curious visitor who tried /macncheese.",
  robots: {
    index: false,
    follow: false,
  },
};

const equipment = [
  "5 quart sauce pan",
  "measuring spoons",
  "measuring cups",
  "spatula",
  "glass batter bowl",
  "whisk",
];

const ingredients = [
  "8 ounces elbow macaroni, uncooked",
  "2 tablespoons salted butter",
  "2 tablespoons all-purpose flour",
  "1/2 teaspoon sea salt",
  "1/4 teaspoon garlic powder, optional but recommended",
  "1 cup whole milk",
  "1/4 cup sour cream or Greek yogurt",
  "8 ounces shredded cheddar cheese (about 2 cups)",
];

const instructions = [
  "Cook the elbow macaroni according to the package instructions. Add 1/4 teaspoon salt to the water before boiling the noodles. Drain and set aside.",
  "Mix the flour, sea salt, and garlic powder together in a small bowl. Set aside.",
  "In a medium saucepan over medium heat, melt the butter.",
  "Add the flour mixture and whisk to combine.",
  "Cook for 1 minute until the mixture is lightly browned.",
  "Add the milk and whisk until the sauce is smooth.",
  "Add the sour cream or Greek yogurt and whisk until smooth again.",
  "Cook over medium-high heat until thickened, about 3 to 5 minutes. Do not let it boil.",
  "Once the sauce is thick enough to coat the back of a spatula, turn the heat to low and add the cheese. Whisk until melted and smooth, then taste and add more salt or seasoning if you want.",
  "Add the cooked pasta to the cheese sauce and stir until everything is evenly coated.",
  "Let the mac and cheese rest for 3 to 5 minutes so the sauce thickens a little and clings to the noodles. Serve warm.",
];

const notes = [
  {
    title: "How to Store Mac & Cheese",
    body: "Store in an airtight container in the refrigerator for up to 5 days.",
  },
  {
    title: "Reheat",
    body: "Reheat on the stovetop or in the microwave. You may need to add 1 to 2 tablespoons of milk to make it creamy again after storing.",
  },
];

const substitutions = [
  {
    title: "Macaroni",
    body: "Pretty much any noodle works here. Gluten-free pasta, whole wheat pasta, chickpea pasta, and other shapes all work well.",
  },
  {
    title: "All-purpose flour",
    body: "Cornstarch, tapioca starch or flour, and all-purpose gluten-free flour are all reasonable swaps.",
  },
  {
    title: "Milk",
    body: "Any liquid dairy works, but higher fat milk makes the sauce creamier. 2% milk, whole milk, half and half, and cream all work.",
  },
  {
    title: "Sour cream",
    body: "Greek yogurt works well in place of sour cream.",
  },
  {
    title: "Cheese",
    body: "A high-quality medium to sharp cheddar gives the best flavor.",
  },
  {
    title: "Garlic powder",
    body: "Optional, but it adds a little extra flavor without making the recipe too strong.",
  },
];

export default function MacNCheesePage() {
  return (
    <div className="bg-paper">
      <section className="relative overflow-hidden border-b border-gold/20 bg-[linear-gradient(180deg,#fbf7ef_0%,#f6f3ec_100%)]">
        <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_20%_20%,rgba(201,162,39,0.35)_0,transparent_18%),radial-gradient(circle_at_80%_0%,rgba(18,53,36,0.12)_0,transparent_16%),radial-gradient(circle_at_80%_80%,rgba(201,162,39,0.18)_0,transparent_18%)]" />
        <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-36 sm:px-6 sm:py-16 lg:px-8">
          <button
            type="button"
            disabled
            className="absolute right-4 top-4 w-[calc(100%-2rem)] max-w-[18rem] rounded-sm border border-gold/35 bg-gold/10 px-3 py-2 text-left text-forestdeep disabled:cursor-not-allowed sm:right-6 sm:top-6 sm:w-60 lg:right-8"
          >
            <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-forest/65">
              Next?
            </span>
            <span className="mt-1 block text-xs leading-snug">
              Want to learn how to make pasta? Good initiative, but we don&apos;t have a recipe for
              that. Sorry... better luck next time.
            </span>
          </button>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-forest/70">
            Hidden route detected
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-forestdeep sm:text-5xl">
            Why did you try to go to livermoregea.org/macncheese?
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-graphite/80 sm:text-lg">
            We are not a food company, but since we&apos;re nice, here&apos;s a mac and cheese
            recipe anyway.
          </p>
          <nav aria-label="Recipe sections" className="mt-8 flex flex-wrap gap-2">
            {[
              ["Equipment", "#equipment"],
              ["Ingredients", "#ingredients"],
              ["Instructions", "#instructions"],
              ["Notes", "#notes"],
              ["Substitutions", "#substitutions"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-sm border border-forest/20 bg-white/70 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-forestdeep transition-colors hover:border-gold hover:bg-gold/10 focus:outline-none focus:ring-2 focus:ring-gold/60"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-sm border border-gold/15 bg-white/70 p-6 shadow-[0_10px_40px_rgba(31,36,33,0.06)] backdrop-blur-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-forest/70">
                  Recipe card
                </p>
                <h2 className="mt-2 font-display text-3xl text-forestdeep">Mac & Cheese</h2>
              </div>
              <div className="rounded-sm border border-gold/25 bg-paper px-4 py-2 text-right">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest/55">
                  Serves
                </p>
                <p className="font-display text-2xl text-forestdeep">4</p>
              </div>
            </div>

            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div id="equipment" className="scroll-mt-6">
                <h3 className="font-display text-2xl text-forestdeep">Equipment</h3>
                <ul className="mt-4 space-y-3 text-base leading-relaxed text-graphite/85">
                  {equipment.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div id="ingredients" className="scroll-mt-6">
                <h3 className="font-display text-2xl text-forestdeep">Ingredients</h3>
                <ul className="mt-4 space-y-3 text-base leading-relaxed text-graphite/85">
                  {ingredients.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-gold" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <aside className="rounded-sm border border-gold/15 bg-forestdeep px-6 py-6 text-paper shadow-[0_10px_40px_rgba(18,53,36,0.18)] sm:px-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-goldlight/80">
              Quick note
            </p>
            <p className="mt-3 text-base leading-relaxed text-paper/82">
              This page is intentionally hidden unless someone guesses the route. A tiny reward
              for curiosity. Don&apos;t tell anyone else about this.
            </p>
            <div className="mt-6 rounded-sm border border-paper/12 bg-paper/6 p-4">
              <p className="font-display text-xl text-paper">Pro tip</p>
              <p className="mt-2 text-sm leading-relaxed text-paper/78">
                Use a sharp cheddar for the boldest flavor, and don&apos;t rush the sauce while it
                thickens.
              </p>
            </div>
          </aside>
        </div>

        <div
          id="instructions"
          className="mt-8 scroll-mt-6 rounded-sm border border-gold/15 bg-white/70 p-6 shadow-[0_10px_40px_rgba(31,36,33,0.06)] backdrop-blur-sm sm:p-8"
        >
          <h3 className="font-display text-3xl text-forestdeep">Instructions</h3>
          <ol className="mt-5 space-y-4 text-base leading-relaxed text-graphite/85">
            {instructions.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gold/35 bg-paper font-mono text-xs text-forestdeep">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section id="notes" className="scroll-mt-6 rounded-sm border border-gold/15 bg-paper p-6 sm:p-8">
            <h3 className="font-display text-3xl text-forestdeep">Notes</h3>
            <div className="mt-6 space-y-6">
              {notes.map((note) => (
                <div key={note.title}>
                  <h4 className="text-xl font-semibold text-graphite">{note.title}</h4>
                  <p className="mt-3 text-base leading-relaxed text-graphite/82">{note.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="substitutions"
            className="scroll-mt-6 rounded-sm border border-gold/15 bg-white/70 p-6 shadow-[0_10px_40px_rgba(31,36,33,0.06)] backdrop-blur-sm sm:p-8"
          >
            <h3 className="font-display text-3xl text-forestdeep">Ingredient Substitutions</h3>
            <ul className="mt-5 space-y-4">
              {substitutions.map((item) => (
                <li key={item.title} className="rounded-sm border border-forest/8 bg-paper px-4 py-4">
                  <h4 className="text-lg font-semibold text-graphite">
                    {item.title}.
                  </h4>
                  <p className="mt-2 text-base leading-relaxed text-graphite/82">{item.body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-sm border border-gold/20 bg-forestdeep px-4 py-4 text-paper">
              <h4 className="text-lg font-semibold">Crock Pot</h4>
              <p className="mt-2 text-sm leading-relaxed text-paper/82">
                If you want a slow-cooker version, this recipe is a good starting point for a
                crock pot mac and cheese experiment.
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
