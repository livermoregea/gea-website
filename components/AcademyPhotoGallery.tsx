import Image from "next/image";

const photos = [
  {
    src: "/images/homepage/IMG_6537.jpg",
    alt: "Two GEA students working together at a laptop in the engineering classroom",
    title: "Better ideas start together.",
    caption: "A shared workspace. A different perspective. A chance to figure it out together.",
    tag: "Collaboration",
  },
  {
    src: "/images/homepage/IMG_6218.JPG",
    alt: "A GEA student developing a three-dimensional CAD model on a laptop",
    title: "From a sketch to a model.",
    caption: "Explore shapes, test ideas, and make the details work.",
    tag: "Design",
  },
  {
    src: "/images/homepage/IMG_6546.jpg",
    alt: "A GEA student working on an architectural design in Revit",
    title: "A new way to see a space.",
    caption: "Bring engineering and architecture into the same picture.",
    tag: "Engineering",
  },
];

export default function AcademyPhotoGallery() {
  return (
    <section aria-labelledby="life-at-gea-heading" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-forest">Life at GEA</p>
          <h2 id="life-at-gea-heading" className="mt-3 font-display text-3xl font-medium tracking-tight text-forestdeep sm:text-5xl">Ideas take shape here.</h2>
        </div>
        <p className="max-w-sm text-base leading-relaxed text-graphite/80">A closer look at the classroom, the tools, and the people behind the work.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <figure className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-forest/10">
          <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[420px]">
            <Image src={photos[0].src} alt={photos[0].alt} fill sizes="(min-width: 1024px) 620px, 100vw" className="object-cover" />
          </div>
          <figcaption className="p-6 sm:p-7">
            <span className="inline-block rounded-full bg-gold/20 px-3 py-1 text-xs font-medium text-forestdeep">{photos[0].tag}</span>
            <h3 className="mt-3 font-display text-2xl text-forestdeep">{photos[0].title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-graphite/80">{photos[0].caption}</p>
          </figcaption>
        </figure>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {photos.slice(1).map(photo => (
            <figure key={photo.src} className="grid overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-forest/10 lg:grid-cols-[1.05fr_1fr]">
              <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[260px]">
                <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 1024px) 260px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
              </div>
              <figcaption className="flex flex-col justify-center p-5 sm:p-6">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-forest">{photo.tag}</p>
                <h3 className="mt-3 font-display text-xl text-forestdeep">{photo.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-graphite/80">{photo.caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
