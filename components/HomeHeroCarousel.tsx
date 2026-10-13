"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const slides = [
  { src: "/images/homepage/IMG_3673.jpg", alt: "GEA students presenting hands-on activities in a school auditorium" },
  { src: "/images/homepage/IMG_6537.jpg", alt: "GEA students working together at a classroom laptop" },
  { src: "/images/homepage/IMG_6218.JPG", alt: "A GEA student developing a CAD model in class" },
  { src: "/images/homepage/IMG_3809.jpg", alt: "GEA students collaborating around laptops at a classroom table" },
  { src: "/images/homepage/IMG_6195.JPG", alt: "Two GEA students assembling a wooden shelving unit outside a classroom" },
  { src: "/images/homepage/IMG_6546.jpg", alt: "A GEA student working on an architectural design" },
  { src: "/images/homepage/IMG_6589.jpg", alt: "A GEA student working on an architectural elevation in Revit" },
  { src: "/images/homepage/IMG_3813.jpg", alt: "GEA students working in small groups throughout a science classroom" },
];

export default function HomeHeroCarousel({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState<boolean | null>(null);
  const reducedMotion = useReducedMotion();
  const isPaused = paused ?? reducedMotion;
  const total = slides.length;
  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive(index => (index + 1) % total);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [isPaused, total]);

  const visible = new Set([active, (active + 1) % total, (active - 1 + total) % total]);
  const controls = "inline-flex h-11 min-w-11 items-center justify-center rounded-full text-paper transition hover:bg-white/15";
  function changeSlide(direction: number) {
    setPaused(true);
    setActive(index => (index + direction + total) % total);
  }
  return (
    <div className={`absolute inset-0 z-0 h-full w-full ${className}`} role="region" aria-roledescription="carousel" aria-label="GEA photographs">
      <div className="absolute inset-0 overflow-hidden">
        {slides.map((slide, index) => visible.has(index) && (
          <Image key={slide.src} src={slide.src} alt={slide.alt} fill priority={index === 0} sizes="100vw" className={`object-cover object-center transition-opacity duration-700 ${active === index ? "opacity-100" : "opacity-0"}`} aria-hidden={active !== index} />
        ))}
      </div>
      <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-r from-[#0B2418]/95 via-[#0B2418]/65 to-[#0B2418]/10" />
      <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-t from-[#0B2418]/70 via-transparent to-black/20" />
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-full border border-white/25 bg-forestdeep/95 p-1 text-paper sm:bottom-6 sm:right-6" onFocusCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(true);
      }}>
        <button type="button" onClick={() => changeSlide(-1)} className={controls} aria-label="Previous photo">←</button>
        <span className="min-w-12 text-center text-xs tabular-nums" aria-hidden="true">{active + 1} / {total}</span>
        <button type="button" onClick={() => changeSlide(1)} className={controls} aria-label="Next photo">→</button>
        <button type="button" onClick={() => setPaused(!isPaused)} className={`${controls} px-3 text-xs`} aria-label={isPaused ? "Play photo slideshow" : "Pause photo slideshow"}>{isPaused ? "Play" : "Pause"}</button>
      </div>
      <p className="sr-only" aria-live={isPaused ? "polite" : "off"} aria-atomic="true">Photo {active + 1} of {total}: {slides[active].alt}</p>
    </div>
  );
}
