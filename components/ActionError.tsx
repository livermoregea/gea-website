"use client";

import { useEffect, useRef } from "react";

/** Bring failed submissions back into view without losing entered form values. */
export default function ActionError({ message, className }: { message: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { ref.current?.focus(); }, [message]);
  return <p ref={ref} role="alert" tabIndex={-1} className={className}>{message}</p>;
}
