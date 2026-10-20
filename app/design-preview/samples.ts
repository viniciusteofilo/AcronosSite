import type { NavLink } from "@/components/storefront/nav";
import type { ProductCardData } from "@/components/storefront/product-card";

/** Header links inside the preview point to the preview screens. */
export const PREVIEW_NAV: NavLink[] = [
  { label: "Home", href: "/design-preview/home" },
  { label: "Shop", href: "/design-preview/shop" },
  { label: "Collections", href: "/design-preview/collections" },
  { label: "About", href: "/design-preview/home#about" },
  { label: "Acronos Lab", href: "/design-preview/home#lab" },
  { label: "Sci-Fi", href: "/design-preview/story" },
];

const GRAPHITE = "#1a1a1a";
const CONCRETE = "#6b6b6b";
const BONE = "#e6e2da";

/**
 * Layout samples only. Names say "SAMPLE" and prices are $000.00 on purpose:
 * no product or price is invented. Real data comes from the catalog in Phase 03.
 */
export const SAMPLE_PRODUCTS: ProductCardData[] = [
  { href: "/design-preview/product", name: "Sample // Jacket", code: "ACN-JK-000", price: "$000.00", colors: [GRAPHITE, CONCRETE], status: "new" },
  { href: "/design-preview/product", name: "Sample // Tee", code: "ACN-TS-000", price: "$000.00", colors: [GRAPHITE, BONE] },
  { href: "/design-preview/product", name: "Sample // Cargo pant", code: "ACN-PT-000", price: "$000.00", colors: [GRAPHITE] },
  { href: "/design-preview/product", name: "Sample // Windbreaker", code: "ACN-WB-000", price: "$000.00", colors: [GRAPHITE, CONCRETE], status: "sold_out" },
  { href: "/design-preview/product", name: "Sample // Hoodie", code: "ACN-HD-000", price: "$000.00", colors: [GRAPHITE, CONCRETE, BONE] },
  { href: "/design-preview/product", name: "Sample // Shorts", code: "ACN-SH-000", price: "$000.00", colors: [GRAPHITE] },
  { href: "/design-preview/product", name: "Sample // Vest", code: "ACN-VS-000", price: "$000.00", colors: [CONCRETE] },
  { href: "/design-preview/product", name: "Sample // Cap", code: "ACN-CP-000", price: "$000.00", colors: [GRAPHITE, BONE] },
];

export const SAMPLE_COLORS = [
  { value: "graphite", label: "Graphite", swatch: GRAPHITE },
  { value: "concrete", label: "Concrete", swatch: CONCRETE },
  { value: "bone", label: "Bone", swatch: BONE, available: false },
];

export const SAMPLE_SIZES = [
  { value: "xs", label: "XS", available: false },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];
