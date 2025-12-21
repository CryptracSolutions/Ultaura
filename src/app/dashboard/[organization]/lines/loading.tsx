export default function LoadingLinesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-56 rounded bg-muted animate-pulse" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="rounded-lg border border-border p-4 shadow-sm animate-pulse">
            <div className="h-4 w-24 rounded bg-muted mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-4/5 rounded bg-muted" />
              <div className="h-3 w-3/5 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
