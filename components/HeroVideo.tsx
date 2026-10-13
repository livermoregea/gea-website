"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState<boolean | null>(null);
  const isPaused = paused ?? reducedMotion;
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPaused) video.pause();
    else void video.play().catch(() => setPaused(true));
  }, [isPaused]);
  return (
    <>
      <div aria-hidden="true" className="ssp-hero-video pointer-events-none absolute inset-0 select-none">
        <video ref={videoRef} muted loop playsInline preload="metadata" poster="/images/ssp/headervideo/poster.jpg" className="h-full w-full object-cover" tabIndex={-1} disablePictureInPicture disableRemotePlayback>
          <source src="/images/ssp/headervideo/header.mp4" type="video/mp4" />
        </video>
      </div>
      <button type="button" onClick={() => setPaused(!isPaused)} className="absolute bottom-4 right-4 z-20 min-h-11 rounded-full border border-paper/30 bg-forestdeep/95 px-4 py-2 text-sm text-paper sm:bottom-6 sm:right-6" aria-label={isPaused ? "Play background video" : "Pause background video"}>{isPaused ? "Play video" : "Pause video"}</button>
    </>
  );
}
