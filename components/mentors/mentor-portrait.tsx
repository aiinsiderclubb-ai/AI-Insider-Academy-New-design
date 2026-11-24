import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A mentor's studio portrait in a lit frame: a warm glow behind it, a thin
 * rim, the picture leaning in on hover, and an optional caption laid over
 * the bottom of the photo on frosted glass.
 */
export function MentorPortrait({
  src,
  alt,
  caption,
  note,
  priority,
  sizes = "(min-width: 1024px) 420px, 90vw",
  className,
}: {
  src: string;
  alt: string;
  caption?: string;
  note?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={cn("mentor-portrait zoom-host group relative", className)}>
      <span aria-hidden className="mentor-portrait-glow" />
      <div className="relative aspect-[4/5] overflow-hidden rounded-[26px] border border-line-2 bg-surface-3 shadow-lg">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover object-[50%_28%]"
        />
        {/* the photos carry a wordmark at the top; a soft fade keeps the frame calm */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-black/55 to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
        />
        {caption && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-white backdrop-blur-md sm:inset-x-4 sm:bottom-4">
            <p className="font-display text-[17px] leading-tight font-bold">{caption}</p>
            {note && <p className="mt-1 text-[12px] leading-snug text-white/75">{note}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Small overlapping faces, for "the team" lines. */
export function MentorFaces({ people, size = 36 }: { people: { photo: string; name: string }[]; size?: number }) {
  return (
    <span className="flex -space-x-2.5">
      {people.map((person) => (
        <span
          key={person.photo}
          className="relative overflow-hidden rounded-full border-2 border-surface bg-surface-3"
          style={{ width: size, height: size }}
        >
          <Image src={person.photo} alt={person.name} fill sizes={`${size * 2}px`} className="object-cover object-[50%_25%]" />
        </span>
      ))}
    </span>
  );
}
