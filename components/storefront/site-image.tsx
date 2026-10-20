import { MediaSlot } from "@/components/ui/media-slot";
import type { MediaView } from "@/server/media/library";

/**
 * Renders an image from the media library with responsive sizes, or the labeled placeholder
 * when no image has been chosen yet. The focal point set in the editor stays in view when
 * the same photo is cropped for desktop and mobile.
 */
export function SiteImage({
  media,
  label,
  sizes = "100vw",
  ratio = "4/5",
  fill = false,
  tone = "editorial",
  priority = false,
  className = "",
}: {
  media: MediaView | null | undefined;
  label: string;
  sizes?: string;
  ratio?: string;
  fill?: boolean;
  tone?: "editorial" | "product";
  priority?: boolean;
  className?: string;
}) {
  if (!media) return <MediaSlot label={label} ratio={ratio} fill={fill} tone={tone} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- responsive srcset from our own media library
    <img
      src={media.src}
      srcSet={media.srcSet || undefined}
      sizes={sizes}
      alt={media.alt}
      width={media.width || undefined}
      height={media.height || undefined}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      style={{
        objectPosition: `${media.focalX * 100}% ${media.focalY * 100}%`,
        ...(fill ? {} : { aspectRatio: ratio }),
      }}
      className={`${fill ? "absolute inset-0 h-full w-full" : "block h-auto w-full"} object-cover ${className}`}
    />
  );
}
