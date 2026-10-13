"use client";

import { useState } from "react";

export default function InstructionVideo() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="mt-6 overflow-hidden rounded-sm border border-forest/20 bg-forestdeep text-paper">
      {loaded ? (
        <>
          <div className="aspect-video">
            <iframe src="https://www.youtube-nocookie.com/embed/fVFe5nQ5TMs" title="Science at Stockmens Park activity instructions" className="h-full w-full border-0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </div>
          <button type="button" onClick={() => setLoaded(false)} className="m-3 min-h-11 rounded-full border border-paper/40 px-4 py-2 text-sm hover:bg-paper/10">Close video player</button>
        </>
      ) : (
        <button type="button" onClick={() => setLoaded(true)} className="flex w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center transition hover:bg-paper/5 sm:py-16" aria-label="Load the Science at Stockmens Park instruction video">
          <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-goldlight text-2xl text-forestdeep">▶</span>
          <span className="font-display text-xl sm:text-2xl">Watch the activity instructions</span>
          <span className="max-w-md text-sm text-paper/90">Load the YouTube player, or use the written instructions below.</span>
        </button>
      )}
    </div>
  );
}
