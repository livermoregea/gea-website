export default function AdminLoading({ detail = false }: { detail?: boolean }) {
  return (
    <div className="mx-auto max-w-[84rem] px-4 py-5 sm:px-8 sm:py-8" role="status" aria-busy="true" aria-label="Loading admin page">
      <span className="sr-only">Loading admin page…</span>
      <div className="animate-pulse space-y-6 motion-reduce:animate-none" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 w-56 rounded-[8px] bg-forest/10" />
            <div className="h-4 w-36 rounded-[8px] bg-forest/[0.06]" />
          </div>
          <div className="h-11 w-52 rounded-[8px] bg-forest/[0.06]" />
        </div>
        <div className="flex items-end justify-between border-b border-forest/10 pb-4">
          <div className="space-y-3">
            <div className="h-2.5 w-28 rounded-full bg-gold/30" />
            <div className="h-8 w-56 rounded-full bg-forest/10" />
          </div>
          <div className="hidden h-3 w-32 rounded-full bg-forest/5 sm:block" />
        </div>
        {detail ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-5">
              <div className="h-12 w-72 rounded-[8px] bg-forest/10" />
              <div className="grid gap-3 sm:grid-cols-3"><div className="h-20 rounded-[8px] bg-forest/[0.06]" /><div className="h-20 rounded-[8px] bg-forest/[0.06]" /><div className="h-20 rounded-[8px] bg-forest/[0.06]" /></div>
              <div className="space-y-4 rounded-[8px] border border-forest/10 p-6"><div className="h-4 w-32 rounded-full bg-gold/25" /><div className="h-24 rounded-[8px] bg-forest/[0.05]" /><div className="h-24 rounded-[8px] bg-forest/[0.05]" /></div>
            </div>
            <div className="h-64 rounded-[8px] bg-forest/[0.05]" />
          </div>
        ) : (
          <div className="space-y-4"><div className="h-24 rounded-[8px] bg-forest/[0.05]" /><div className="h-20 rounded-[8px] bg-forest/[0.05]" /><div className="h-20 rounded-[8px] bg-forest/[0.05]" /></div>
        )}
      </div>
    </div>
  );
}
