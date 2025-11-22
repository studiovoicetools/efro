// src/app/dev-seller/page.tsx
"use client";

export default function DevSellerPage() {
  return (
    <main
      style={{
        padding: "2rem",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1>EFRO Dev Seller Playground (Placeholder)</h1>
      <p>
        Diese Seite ist nur ein vereinfachter Platzhalter, damit der
        Production Build sauber durchlaeuft.
      </p>
      <p>
        Spaeter kannst du hier wieder die komplette Seller-Logik einbauen
        (Intent, Cart, Cross-Sell usw.), aber fuer den Start ist das nicht
        noetig.
      </p>
    </main>
  );
}
