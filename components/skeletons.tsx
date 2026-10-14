// Lade-Platzhalter (loading.tsx) – bilden die echten Seitenlayouts nach, damit der Wechsel ohne Springen wirkt.
import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-surface-2", className)} style={style} />;
}

function Loading({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div data-skeleton role="status" aria-label="Wird geladen" className={className}>
      {children}
    </div>
  );
}

function SectionLabel({ w = "w-28" }: { w?: string }) {
  return <Skeleton className={cn("mb-4 h-3", w)} />;
}

function EntryRows({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-3">
          <Skeleton className="mt-0.5 size-5 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4" style={{ width: `${[58, 44, 66, 38, 52, 47][i % 6]}%` }} />
            <Skeleton className="h-3" style={{ width: `${[82, 74, 88, 69, 78, 85][i % 6]}%` }} />
          </div>
          <Skeleton className="mt-0.5 h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function ContactsAside() {
  return (
    <aside className="page-context">
      <SectionLabel />
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function TopicSkeleton() {
  return (
    <Loading className="page-grid has-context">
      <div className="min-w-0">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-3 pt-1">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <section className="mt-10">
          <SectionLabel w="w-20" />
          <EntryRows />
        </section>
      </div>
      <ContactsAside />
    </Loading>
  );
}

export function EntrySkeleton() {
  const lines = [96, 88, 92, 71, 0, 94, 86, 90, 64, 0, 91, 83, 58];
  return (
    <Loading className="page-grid has-context">
      <div className="min-w-0">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-6 h-9 w-3/5" />
        <Skeleton className="mt-4 h-3 w-56" />
        <div className="mt-10 space-y-3">
          {lines.map((w, i) => (w ? <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} /> : <div key={i} className="h-3" />))}
        </div>
      </div>
      <aside className="page-context space-y-9">
        <div>
          <SectionLabel w="w-16" />
          <div className="space-y-2.5">
            {[70, 55, 62].map((w) => (
              <Skeleton key={w} className="h-3" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div>
          <SectionLabel />
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </aside>
    </Loading>
  );
}

export function HomeSkeleton() {
  return (
    <Loading className="mx-auto max-w-[800px] px-8 pt-14 max-[900px]:px-5">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <section className="mt-10 mb-12">
        <SectionLabel w="w-16" />
        <div className="grid grid-cols-2 gap-2.5 px-1 [@media(min-width:1100px)]:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-4">
              <Skeleton className="mb-3 size-9 rounded-[10px]" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionLabel />
        <EntryRows count={5} />
      </section>
    </Loading>
  );
}

export function ListSkeleton() {
  return (
    <Loading className="mx-auto max-w-[800px] px-8 pt-12 max-[900px]:px-5">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-10">
        <EntryRows count={5} />
      </div>
    </Loading>
  );
}

export function SettingsSkeleton() {
  return (
    <Loading className="mx-auto max-w-[720px] px-8 pt-12 max-[900px]:px-5">
      <Skeleton className="h-9 w-56" />
      {[0, 1, 2].map((i) => (
        <section key={i} className="mt-10 rounded-2xl border border-border p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-64 max-w-full" />
          <Skeleton className="mt-6 h-10 w-full rounded-xl" />
        </section>
      ))}
    </Loading>
  );
}

export function PersonalSkeleton() {
  return (
    <Loading className="mx-auto max-w-[1000px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6">
      <Skeleton className="mb-8 h-11 w-full rounded-xl sm:w-[330px]" />
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>
      <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        {Array.from({ length: 12 }, (_, r) => (
          <div key={r} className={cn("flex items-center gap-2 px-3 py-1.5", r > 0 && "border-t border-border", r === 0 && "bg-surface py-3")}>
            <Skeleton className={cn("h-4 shrink-0", r === 0 ? "w-12" : "w-24 max-sm:w-16")} />
            {[0, 1, 2, 3, 4].map((d) => (
              <Skeleton key={d} className={cn("flex-1", r === 0 ? "h-6" : "h-9")} />
            ))}
          </div>
        ))}
      </div>
    </Loading>
  );
}
