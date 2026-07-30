"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const slides = [
  {
    src: "/images/homepage/IMG_3673.jpg",
    alt: "",
  },
  {
    src: "/images/homepage/IMG_6537.jpg",
    alt: "",
  },
  {
    src: "/images/homepage/IMG_6218.JPG",
    alt: "",
  },
  {
    src: "/images/homepage/IMG_3809.jpg",
    alt: "",
  },
  {
    src: "/images/homepage/IMG_6195.JPG",
    alt: "",
  },
  {
    src: "/images/homepage/IMG_6546.jpg",
    alt: "",
  },
  {
    src: "/images/homepage/IMG_6589.jpg",
    alt: "",
  },
  {
    src: "/images/homepage/IMG_3813.jpg",
    alt: "",
  },
];

type HomeHeroCarouselProps = {
  className?: string;
};

export default function HomeHeroCarousel({ className = "" }: HomeHeroCarouselProps) {
  const [active, setActive] = useState(0);
  const total = slides.length;
  const images = slides;

  const visibleIndices = new Set([
    active,
    (active + 1) % total,
    (active - 1 + total) % total,
  ]);

  function goToSlide(index: number) {
    setActive(index);
  }

  function goToNext() {
    setActive((current) => (current + 1) % total);
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % total);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [total]);

  const slideStage = (
    <div className="absolute inset-0 w-full h-full -z-20 overflow-hidden">
      {slides.map((slide, index) => {
        if (!visibleIndices.has(index)) return null;

        const isActive = active === index;

        return (
          <Image
            key={slide.src}
            src={slide.src}
            alt={`GEA Slide ${index + 1}`}
            fill
            priority={index === 0}
            sizes="100vw"
            className={`object-cover object-center transition-all duration-1000 ease-in-out ${
              isActive ? "opacity-100 scale-100" : "opacity-0 scale-105"
            }`}
            aria-hidden={!isActive}
          />
        );
      })}
    </div>
  );

  const controls = (
    <div className="absolute bottom-4 right-4 z-50 md:bottom-6 md:right-12">
      <div className="pointer-events-auto rounded-full border border-white/15 bg-[#102419]/45 px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.22)] backdrop-blur-md">
        <div className="flex items-center gap-2">
          {images.map((_, index) => {
            const isActive = active === index;
            return (
              <button
                key={index}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToSlide(index);
                }}
                style={{ minHeight: 0 }}
                className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8963E] ${
                  isActive ? "w-8 bg-[#C8963E]" : "w-2.5 bg-white/35 hover:bg-white/60"
                }`}
                aria-label={`Go to slide ${index + 1}`}
                aria-pressed={isActive}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`absolute inset-0 z-0 h-full w-full ${className}`}
      onClick={goToNext}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goToNext();
        }
      }}
      role="region"
      aria-label="Homepage hero image carousel"
      tabIndex={0}
    >
      {slideStage}

      {/* Duo-Tone Brand Color Overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-tr from-[#1A362B]/90 via-[#1A362B]/70 to-[#C8963E]/30 mix-blend-multiply" />

      {/* Dark Contrast Scrim for Text Legibility */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#1A362B] via-transparent to-black/40" />

      {controls}

      <p className="sr-only" aria-live="polite">
        Showing slide {active + 1} of {total}
      </p>
    </div>
  );
}
