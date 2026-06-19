import { Skeleton } from "./Skeleton";

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <Skeleton className="h-4 w-16 mb-2" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex gap-4">
        <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-12 w-full rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
