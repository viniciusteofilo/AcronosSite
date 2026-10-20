import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MediaSlot } from "@/components/ui/media-slot";

export type ProductCardData = {
  href: string;
  name: string;
  code: string;
  price: string;
  colors?: string[];
  status?: "sold_out" | "new" | null;
  imageLabel?: string;
};

/** Product tile: photo on a light ground (product is the protagonist), mono metadata below. */
export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <article className="group relative flex flex-col gap-3">
      <div className="relative overflow-hidden">
        <MediaSlot label={product.imageLabel ?? "Product photo · 1600×2000"} tone="light" className="transition-transform duration-500 group-hover:scale-[1.02]" />
        {product.status && (
          <span className="absolute left-3 top-3">
            <Badge tone={product.status === "sold_out" ? "alert" : "inverse"}>
              {product.status === "sold_out" ? "Sold out" : "New"}
            </Badge>
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.14em]">
            <Link href={product.href} className="after:absolute after:inset-0">
              {product.name}
            </Link>
          </h3>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{product.code}</p>
        </div>
        <p className="font-mono text-[11px] tracking-[0.08em]">{product.price}</p>
      </div>
      {product.colors && product.colors.length > 0 && (
        <ul className="flex gap-1.5" aria-label={`${product.colors.length} colors`}>
          {product.colors.map((c) => (
            <li key={c} className="h-2.5 w-2.5 rounded-full border border-concrete" style={{ background: c }} />
          ))}
        </ul>
      )}
    </article>
  );
}
