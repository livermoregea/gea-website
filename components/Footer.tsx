export default function Footer() {
  return (
    <footer className="border-t border-forest/10 bg-forest text-paper/70">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-base text-gold">Green Engineering Academy</p>
            <p className="mt-1 font-mono text-xs text-paper/50">
              Livermore High School &middot; 600 Maple Street, Livermore, CA 94550
            </p>
          </div>
          <div className="font-mono text-xs uppercase tracking-[0.15em] text-paper/50">
            <p>EST. 2010</p>
            <p className="mt-1">A California Partnership Academy</p>
          </div>
        </div>
        <div className="dim-divider my-6" />
        <p className="font-mono text-[11px] text-paper/40">
          Questions about the academy or a leadership role? Reach the GEA coordinators through
          your academic counselor or LHS Academics office.
        </p>
      </div>
    </footer>
  );
}
