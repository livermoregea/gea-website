"use client";

import { useEffect, useRef, useState } from 'react';

/** Uncontrolled task forms: persist each edit, including browser-invalid values. */
export function useFormDraft(key: string) {
  const ref = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    setSaved(false); setUnavailable(false);
    try {
      const raw = localStorage.getItem(key);
      if (!raw || !ref.current) return;
      const fields = JSON.parse(raw) as Record<string, unknown>;
      for (const element of Array.from(ref.current.elements)) {
        if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)
          && !('readOnly' in element && element.readOnly) && typeof fields[element.name] === 'string') element.value = fields[element.name] as string;
      }
      setSaved(true);
    } catch { setUnavailable(true); }
  }, [key]);
  function persist() {
    if (!ref.current) return;
    const fields: Record<string, string> = {};
    for (const element of Array.from(ref.current.elements)) {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        if (element.name) fields[element.name] = element.value;
      }
    }
    try { localStorage.setItem(key, JSON.stringify(fields)); setSaved(true); setUnavailable(false); }
    catch { setSaved(false); setUnavailable(true); }
  }
  function clear() {
    try { localStorage.removeItem(key); } catch { /* Keep the successful server save. */ }
    setSaved(false);
  }
  return { ref, persist, clear, saved, unavailable };
}
