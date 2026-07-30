export default function RouteLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <div className="animate-pulse space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-3 w-44 rounded-full bg-forest/10" />
            <div className="h-8 w-72 rounded-full bg-forest/15" />
          </div>
          <div className="h-10 w-28 rounded-sm bg-forest/10" />
        </div>

        <div className="rounded-sm border border-forest/10 bg-paper p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="h-3 w-36 rounded-full bg-forest/10" />
              <div className="h-20 rounded-sm bg-forest/5" />
              <div className="h-10 w-32 rounded-sm bg-forest/10" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-40 rounded-full bg-forest/10" />
              <div className="h-20 rounded-sm bg-forest/5" />
              <div className="h-10 w-32 rounded-sm bg-forest/10" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-44 rounded-sm bg-forest/[0.04] ring-1 ring-forest/5" />
          <div className="h-44 rounded-sm bg-forest/[0.04] ring-1 ring-forest/5" />
          <div className="h-44 rounded-sm bg-forest/[0.04] ring-1 ring-forest/5" />
        </div>

        <div className="rounded-sm bg-forest/[0.03] p-5 ring-1 ring-forest/5">
          <div className="space-y-4">
            <div className="h-3 w-32 rounded-full bg-forest/10" />
            <div className="h-4 w-56 rounded-full bg-forest/15" />
            <div className="grid gap-3">
              <div className="h-12 rounded-sm bg-paper" />
              <div className="h-24 rounded-sm bg-paper" />
              <div className="h-11 w-44 rounded-sm bg-forest/15" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-32 rounded-sm bg-paper ring-1 ring-forest/5" />
          <div className="h-32 rounded-sm bg-paper ring-1 ring-forest/5" />
        </div>
      </div>
    </div>
  );
}
