import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { MediaView } from "@/server/media/library";
import { SiteImage } from "./site-image";

export type ProductCardData = {
  href: string;
  name: string;
  code: string;
  price: string;
  compareAt?: string | null;
  colors?: string[];
  status?: "sold_out" | "new" | null;
  image?: MediaView | null;
  imageLabel?: string;
};

/** Product tile: photo on a light ground (product is the protagonist), mono metadata below. */
export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col gap-3">
      <div className="relative overflow-hidden">
        <SiteImage
          media={product.image}
          label={product.imageLabel ?? "Product photo · 1600×2000"}
          tone="product"
          sizes="(min-width: 1024px) 25vw, 50vw"
          priority={priority}
          className="transition-transform duration-500 group-hover:scale-[1.02]"
        />
        {product.status && (
          <span className="absolute left-3 top-3">
            <Badge tone={product.status === "sold_out" ? "alert" : "inverse"}>
              {product.status === "sold_out" ? "Sold out" : "New"}
            </Badge>
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em]">
            <Link href={product.href} className="after:absolute after:inset-0">
              {product.name}
            </Link>
          </h3>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{product.code}</p>
        </div>
        <p className="shrink-0 text-right font-mono text-[11px] tracking-[0.08em]">
          {product.compareAt && (
            <>
              <span className="sr-only">Was </span>
              <s className="mr-2 text-muted">{product.compareAt}</s>
              <span className="sr-only">now </span>
            </>
          )}
          {product.price}
        </p>
      </div>
      {product.colors && product.colors.length > 0 && (
        <ul className="flex gap-1.5" aria-label={`${product.colors.length} ${product.colors.length === 1 ? "color" : "colors"}`}>
          {product.colors.map((c) => (
            <li key={c} className="h-2.5 w-2.5 rounded-full border border-line" style={{ background: c }} />
          ))}
        </ul>
      )}
    </article>
  );
}

/** Adapts a catalog row to the card. */
export function toCard(
  p: {
    slug: string;
    name: string;
    code: string;
    priceMinor: number;
    compareAtMinor: number | null;
    available: number;
    colors: string[];
    image: MediaView | null;
    isNew: boolean;
  },
  format: (minor: number) => string,
): ProductCardData {
  return {
    href: `/products/${p.slug}`,
    name: p.name,
    code: p.code,
    price: format(p.priceMinor),
    compareAt: p.compareAtMinor && p.compareAtMinor > p.priceMinor ? format(p.compareAtMinor) : null,
    colors: p.colors,
    status: p.available <= 0 ? "sold_out" : p.isNew ? "new" : null,
    image: p.image,
  };
}
