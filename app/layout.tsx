import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Bubble Monitor",
  description:
    "Daily dashboard of AI bubble stress signals: chips, hyperscalers, neoclouds, private credit, BDCs, GPU rental prices, credit spreads, labor and news.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
