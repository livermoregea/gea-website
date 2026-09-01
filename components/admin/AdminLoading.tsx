export default function AdminLoading({ detail = false }: { detail?: boolean }) {
  return (
    <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 md:py-10" aria-busy="true" aria-label="Loading admin page">
      <div className="animate-pulse space-y-6">
        <div className="rounded-sm border border-forest/10 bg-paper p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="h-16 rounded-sm bg-forest/[0.06]" />
            <div className="h-16 rounded-sm bg-forest/[0.06]" />
            <div className="h-16 rounded-sm bg-forest/[0.06]" />
          </div>
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
              <div className="h-12 w-72 rounded-sm bg-forest/10" />
              <div className="grid gap-3 sm:grid-cols-3"><div className="h-20 rounded-sm bg-forest/[0.06]" /><div className="h-20 rounded-sm bg-forest/[0.06]" /><div className="h-20 rounded-sm bg-forest/[0.06]" /></div>
              <div className="space-y-4 rounded-sm border border-forest/10 p-6"><div className="h-4 w-32 rounded-full bg-gold/25" /><div className="h-24 rounded-sm bg-forest/[0.05]" /><div className="h-24 rounded-sm bg-forest/[0.05]" /></div>
            </div>
            <div className="h-64 rounded-sm bg-forest/[0.05]" />
          </div>
        ) : (
          <div className="space-y-4"><div className="h-24 rounded-sm bg-forest/[0.05]" /><div className="h-20 rounded-sm bg-forest/[0.05]" /><div className="h-20 rounded-sm bg-forest/[0.05]" /></div>
        )}
      </div>
    </div>
  );
}
