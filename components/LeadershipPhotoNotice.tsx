"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { isScreenshotShortcut, shouldCoverLeadershipPhotos } from "@/lib/screenshot-shortcuts";

const PhotoNoticeContext = createContext({ showNotice: () => {}, photosHidden: false });

export function ProtectedLeadershipPhoto({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { showNotice, photosHidden } = useContext(PhotoNoticeContext);

  return (
    <div
      className={`relative select-none [-webkit-touch-callout:none] [&_img]:pointer-events-none [&_img]:select-none [&_img]:[-webkit-user-drag:none] ${className}`}
      onContextMenu={(event) => {
        event.preventDefault();
        showNotice();
      }}
      onDragStart={(event) => {
        event.preventDefault();
        showNotice();
      }}
    >
      {children}
      <span
        aria-hidden="true"
        draggable={false}
        className={`absolute inset-0 z-10 ${photosHidden ? "flex items-center justify-center bg-paper p-2 text-center text-xs text-forest" : ""}`}
      >
        {photosHidden ? "Please contact GEA for a photo." : null}
      </span>
    </div>
  );
}

export default function LeadershipPhotoNotice({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [photosHidden, setPhotosHidden] = useState(false);
  const showNotice = useCallback(() => {
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, []);

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const restorePhotos = () => setPhotosHidden(false);
    const handleShortcut = (event: KeyboardEvent) => {
      // Cover on Shift + Command/Windows, Option/Alt, or Control, before the
      // OS consumes the final key. Keep unrelated shortcuts functional.
      flushSync(() => setPhotosHidden(shouldCoverLeadershipPhotos(event)));
      // Some browsers only deliver Print Screen on keyup. OS-reserved shortcuts
      // may never reach the page; this notice cannot guarantee capture prevention.
      if (event.type === "keyup" && event.key !== "PrintScreen" && event.code !== "PrintScreen") return;
      if (!isScreenshotShortcut(event, isMac)) return;

      event.preventDefault();
      if (!event.repeat) showNotice();
    };

    window.addEventListener("keydown", handleShortcut, true);
    window.addEventListener("keyup", handleShortcut, true);
    // Keep the cover if a capture tool takes focus; reset on return in case
    // the browser missed the key releases while the tool was active.
    window.addEventListener("focus", restorePhotos);
    return () => {
      window.removeEventListener("keydown", handleShortcut, true);
      window.removeEventListener("keyup", handleShortcut, true);
      window.removeEventListener("focus", restorePhotos);
    };
  }, [showNotice]);

  return (
    <PhotoNoticeContext.Provider value={{ showNotice, photosHidden }}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="photo-notice-title"
        aria-describedby="photo-notice-description"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-sm border border-forest/15 bg-paper p-6 text-graphite shadow-xl backdrop:bg-paper sm:p-8"
      >
        <h2 id="photo-notice-title" className="font-display text-2xl text-forest">
          Let’s share our best shot!
        </h2>
        <p id="photo-notice-description" className="mt-3 text-sm leading-relaxed text-graphite/75">
          Our team is pretty photogenic, right? Reach out to GEA if you’d like a
          leadership portrait or team photo—we’re happy to help!
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-forest px-5 py-3 text-sm text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
          >
            Contact GEA
          </a>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-sm border border-forest/20 px-5 py-3 text-sm text-forest hover:bg-forest/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
          >
            Keep browsing
          </button>
        </div>
      </dialog>
    </PhotoNoticeContext.Provider>
  );
}
