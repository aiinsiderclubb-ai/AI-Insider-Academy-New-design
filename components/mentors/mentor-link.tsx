import { cn } from "@/lib/utils";

/**
 * The thread that carries the eye from one mentor's portrait to the next.
 *
 * On wide screens the rows alternate sides, so the thread is an S-curve from
 * under one portrait to above the other, with a node at each end, flowing
 * dashes and a spark travelling down it. On narrow screens it is a short
 * vertical stitch with the same spark.
 */
export function MentorLink({ from, index }: { from: "left" | "right"; index: number }) {
  // Portrait centres sit at about a fifth of the width from their side.
  const a = from === "left" ? 200 : 800;
  const b = from === "left" ? 800 : 200;
  const d = `M${a} 0 C ${a} 90, ${b} 70, ${b} 160`;
  const id = `mentor-link-${index}`;

  return (
    <div aria-hidden className="relative">
      <svg viewBox="0 0 1000 160" preserveAspectRatio="none" className="hidden h-40 w-full overflow-visible lg:block">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path d={d} className="mentor-link-glow" vectorEffect="non-scaling-stroke" />
        <path d={d} stroke={`url(#${id})`} className="mentor-link-path" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* nodes and the spark live outside the stretched SVG so they stay round */}
      <span className={cn("mentor-link-node hidden lg:block", from === "left" ? "left-[20%]" : "left-[80%]", "top-0")} />
      <span className={cn("mentor-link-node hidden lg:block", from === "left" ? "left-[80%]" : "left-[20%]", "top-full")} />
      <span
        className={cn("mentor-link-spark hidden lg:block", from === "left" ? "mentor-link-spark-lr" : "mentor-link-spark-rl")}
        style={{ animationDelay: `${index * -1.4}s` }}
      />

      <div className="relative mx-auto h-24 w-px lg:hidden">
        <span className="absolute inset-0 bg-gradient-to-b from-accent/70 to-accent/10" />
        <span className="mentor-link-node left-1/2 top-0" />
        <span className="mentor-link-node left-1/2 top-full" />
        <span className="mentor-link-spark mentor-link-spark-down" />
      </div>
    </div>
  );
}
