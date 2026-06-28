function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} aria-hidden />;
}

export function FoodCardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-2 space-y-2">
      <div className="flex gap-2">
        <Bone className="w-10 h-10 rounded-md shrink-0" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <Bone className="h-3 w-4/5" />
          <Bone className="h-2.5 w-1/2" />
        </div>
      </div>
      <Bone className="h-2 w-full" />
    </div>
  );
}

export function CompareColumnSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <FoodCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DiscoverCardSkeleton() {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <Bone className="h-4 w-3/4" />
      <Bone className="h-3 w-1/2" />
      <div className="flex gap-1">
        <Bone className="h-5 w-14 rounded-full" />
        <Bone className="h-5 w-16 rounded-full" />
        <Bone className="h-5 w-12 rounded-full" />
      </div>
      <div className="space-y-2 pt-1">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-2">
            <Bone className="w-9 h-9 rounded-md shrink-0" />
            <div className="flex-1 space-y-1 pt-1">
              <Bone className="h-3 w-full" />
              <Bone className="h-2.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <Bone className="h-8 w-full rounded-lg" />
    </article>
  );
}

export function DiscoverGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <DiscoverCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SearchInsightsSkeleton() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm px-3 sm:px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-2">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-4 w-2/3 max-w-md" />
          <Bone className="h-3 w-full max-w-lg" />
        </div>
        <div className="grid grid-cols-4 gap-2 w-full lg:w-[min(100%,420px)] shrink-0">
          {Array.from({ length: 4 }, (_, i) => (
            <Bone key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    </section>
  );
}
