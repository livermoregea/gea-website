"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export default function RouteLoading({ label = "Loading page…" }: { label?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  // Avoid flashing the loading screen during quick navigations.
  useEffect(() => {
    const timeout = window.setTimeout(() => setReady(true), 350);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    if (reducedMotion || paused) video.pause();
    else void video.play().catch(() => setPaused(true));
  }, [ready, reducedMotion, paused, failed]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-4 py-10 sm:px-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {ready && (
        <div className="flex flex-col items-center gap-4 text-center">
          {reducedMotion || failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/images/gea-loading-poster.png" alt="" width={224} height={224} className="h-48 w-48 object-contain mix-blend-multiply sm:h-56 sm:w-56" aria-hidden="true" />
          ) : (
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="auto"
              poster="/images/gea-loading-poster.png"
              className="h-48 w-48 object-contain mix-blend-multiply sm:h-56 sm:w-56"
              aria-hidden="true"
              tabIndex={-1}
              disablePictureInPicture
              disableRemotePlayback
              onError={() => setFailed(true)}
            >
              <source src="/videos/gea-logo-spin.mp4" type="video/mp4" onError={() => setFailed(true)} />
            </video>
          )}
          <p aria-hidden="true" className="text-sm text-graphite/80">{label}</p>
          {!reducedMotion && !failed && (
            <button type="button" onClick={() => setPaused(!paused)} className="rounded-sm px-3 text-xs text-graphite/70 underline underline-offset-4 hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
              {paused ? "Play animation" : "Pause animation"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
