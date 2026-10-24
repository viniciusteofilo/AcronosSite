import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { isTestEnvironment, siteUrl } from "@/lib/site-url";

// Self-hosted (SIL Open Font License): no runtime request to third-party font servers.
const inter = localFont({
  src: "../assets/fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
const spaceMono = localFont({
  src: [
    {
      path: "../assets/fonts/space-mono-latin-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../assets/fonts/space-mono-latin-700-normal.woff2",
      weight: "700",
    },
  ],
  variable: "--font-space-mono",
  display: "swap",
});
const orbitron = localFont({
  src: "../assets/fonts/orbitron-latin-wght-normal.woff2",
  variable: "--font-orbitron",
  weight: "400 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "ACRONOS", template: "%s · ACRONOS" },
  description: "Future observed from everyday chaos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceMono.variable} ${orbitron.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {isTestEnvironment() && (
          <p className="bg-alert px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-paper">
            Test environment · not a real store · no real payments
          </p>
        )}
        {children}
      </body>
    </html>
  );
}
