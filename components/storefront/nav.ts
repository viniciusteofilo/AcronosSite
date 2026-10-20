export type NavLink = { label: string; href: string };

/** Final storefront routes (Phase 03). Labels in US English per the protocol. */
export const MAIN_NAV: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Collections", href: "/collections" },
  { label: "About", href: "/about" },
  { label: "Acronos Lab", href: "/lab" },
  { label: "Sci-Fi", href: "/sci-fi" },
];

export const FOOTER_NAV: { title: string; links: NavLink[] }[] = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/shop" },
      { label: "Collections", href: "/collections" },
      { label: "Archive", href: "/collections/archive" },
    ],
  },
  {
    title: "Acronos",
    links: [
      { label: "About", href: "/about" },
      { label: "Acronos Lab", href: "/lab" },
      { label: "Acronos Sci-Fi", href: "/sci-fi" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Shipping", href: "/policies/shipping" },
      { label: "Returns", href: "/policies/returns" },
      { label: "Privacy", href: "/policies/privacy" },
      { label: "Terms", href: "/policies/terms" },
    ],
  },
];
