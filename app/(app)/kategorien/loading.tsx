import { Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Wird geladen"
      className="mx-auto max-w-[1000px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <Skeleton className="mt-8 h-11 w-full rounded-xl sm:w-[300px]" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
