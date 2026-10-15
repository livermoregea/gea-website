"use client";

import { useEffect } from "react";

export function leavesCurrentPage(href: string, currentHref: string) {
  const next = new URL(href, currentHref);
  const current = new URL(currentHref);
  if (next.protocol !== "https:" && next.protocol !== "http:") return false;
  return next.origin !== current.origin || next.pathname !== current.pathname || next.search !== current.search;
}

/** Protect outstanding drafts when following links, signing out, or unloading. */
export function useUnsavedChanges(dirty: boolean, message = "You have unsaved changes. Leave this page and discard them?") {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: Event) => { if (!window.confirm(message)) event.preventDefault(); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self") || !leavesCurrentPage(link.href, window.location.href)) return;
      if (!window.confirm(message)) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("gea:before-navigation", navigate);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("gea:before-navigation", navigate);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, message]);
}
