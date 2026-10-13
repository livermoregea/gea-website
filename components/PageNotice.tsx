import type { ReactNode } from "react";

export default function PageNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 md:py-16">
      <h1 className="font-display text-2xl text-forestdeep sm:text-3xl">{title}</h1>
      <div className="mt-4 text-base leading-relaxed text-graphite/80">{children}</div>
    </div>
  );
}
