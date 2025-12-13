// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import EfroSalesWidget from "@/components/landing/EfroSalesWidget";

export const metadata: Metadata = {
  title: "EFRO – Avatar Seller für Shopify",
  description: "Shopify Verkaufsassistent mit KI-Avatar (Chat + Voice + Empfehlungen).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        {children}
        {/* Globales Widget: bleibt beim Navigieren erhalten */}
        <EfroSalesWidget />
      </body>
    </html>
  );
}
