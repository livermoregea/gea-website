"use client";

import { useEffect, useState } from "react";

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
  const [paused, setPaused] = useState(false);
  const total = slides.length;
  const images = slides;
  const activeIndex = active;
  const setActiveIndex = setActive;

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(() => {
      setActive((index) => (index + 1) % total);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [paused, total]);

  const slideStage = (
    <div className="absolute inset-0 w-full h-full -z-20 overflow-hidden">
      {slides.map((slide, index) => (
        <img
          key={index}
          src={slide.src}
          alt={`GEA Slide ${index + 1}`}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-1000 ease-in-out ${
            active === index ? "opacity-100 scale-100" : "opacity-0 scale-105"
          }`}
          aria-hidden={active !== index}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
    </div>
  );

  const controls = (
    <>
      {/* CAROUSEL INDICATORS */}
      <div
        className="absolute bottom-6 right-8 md:right-12 z-30 flex items-center gap-2 pointer-events-auto"
        style={{ height: "16px", maxHeight: "16px" }}
      >
        {images.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setActiveIndex(index)}
            style={{
              height: "4px",
              maxHeight: "4px",
              minHeight: "4px",
              padding: 0,
              margin: 0,
              border: "none",
              outline: "none",
              display: "block",
            }}
            className={`rounded-full transition-all duration-300 cursor-pointer ${
              activeIndex === index ? "w-8 bg-[#C8963E]" : "w-3 bg-white/40 hover:bg-white/70"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </>
  );

  return (
    <div
      className={`absolute inset-0 z-0 h-full w-full ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-label="Homepage hero image carousel"
    >
      {slideStage}

      {/* Duo-Tone Brand Color Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#1A362B]/90 via-[#1A362B]/70 to-[#C8963E]/30 mix-blend-multiply -z-10" />

      {/* Dark Contrast Scrim for Text Legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1A362B] via-transparent to-black/40 -z-10" />

      {controls}

      <p className="sr-only" aria-live="polite">
        Showing slide {active + 1} of {total}
      </p>
    </div>
  );
}
