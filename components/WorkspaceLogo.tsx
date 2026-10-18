"use client";

import Image from "next/image";
import { useState } from "react";
import { useWorkspaceActivity } from "./WorkspaceActivityProvider";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Matching transparent assets, sized for the 40px header at 3x density.
const STILL = "/images/gea-workspace-logo.png";
const ANIMATION = "/images/gea-workspace-spin.gif";

export default function WorkspaceLogo() {
  const activity = useWorkspaceActivity()?.activity;
  const reducedMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const animate = Boolean(activity) && !reducedMotion && !failed;

  return <>
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden="true">
      <Image src={animate ? ANIMATION : STILL} alt="" width={40} height={40} unoptimized
        onError={() => { if (animate) setFailed(true); }}
        className="h-full w-full object-contain" />
      {activity && (reducedMotion || failed) && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-paper bg-forest" />}
    </span>
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {activity === "saving" ? "Saving changes…" : activity ? "Updating workspace…" : ""}
    </span>
  </>;
}
