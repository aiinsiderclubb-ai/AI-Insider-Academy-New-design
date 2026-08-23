import { Container } from "@/components/primitives/surface";
import { Skeleton, SkeletonText } from "@/components/primitives/display";

/** Skeletons shaped like the page that follows, not a spinner in the void. */
export default function SiteLoading() {
  return (
    <Container size="wide" className="py-14">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-6 h-14 w-[min(38rem,90%)]" />
      <Skeleton className="mt-3 h-14 w-[min(28rem,70%)]" />
      <div className="mt-8 max-w-xl">
        <SkeletonText lines={2} />
      </div>
      <div className="mt-9 flex gap-3">
        <Skeleton className="h-12 w-44 rounded-md" />
        <Skeleton className="h-12 w-40 rounded-md" />
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-line bg-surface">
            <Skeleton className="aspect-[21/9] rounded-none" />
            <div className="flex flex-col gap-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-4/5" />
              <SkeletonText lines={2} />
              <Skeleton className="mt-2 h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
