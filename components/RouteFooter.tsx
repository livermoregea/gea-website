"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function RouteFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWorkspace = ["/admin-portal-x7k9", "/officerboard"].some(
    route => pathname === route || pathname?.startsWith(`${route}/`),
  );

  return isWorkspace ? null : children;
}
