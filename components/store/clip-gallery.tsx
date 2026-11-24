/* eslint-disable @next/next/no-img-element -- posters set the size of each tile; next/image would need their dimensions up front */
import { HoverVideo } from "@/components/store/hover-video";

/**
 * A row of example clips made with the product. Each tile is its poster at its
 * own shape (wide or tall) and plays when pointed at or focused. A clip's name
 * comes from its file: `kinetic-type.mp4` reads "kinetic type".
 */
export function ClipGallery({ clips, title, hint }: { clips: string[]; title: string; hint: string }) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[19px]">{title}</h2>
        <p className="text-[13px] text-muted">{hint}</p>
      </div>
      <div className="scroll-x -mx-5 mt-4 px-5 pb-2 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-3">
          {clips.map((clip) => {
            const poster = clip.replace(/\.mp4$/, ".jpg");
            const name = clip.split("/").pop()?.replace(/\.mp4$/, "").replace(/[-_]+/g, " ") ?? "";
            return (
              <li key={clip}>
                <article className="group">
                  <div className="relative h-64 overflow-hidden rounded-lg border border-line bg-ground sm:h-80">
                    <img src={poster} alt="" loading="lazy" className="h-full w-auto" />
                    <HoverVideo src={clip} poster={poster} />
                  </div>
                  <p className="mt-2 font-mono text-[11.5px] text-muted">{name}</p>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
