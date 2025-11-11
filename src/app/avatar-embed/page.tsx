'use client';

// src/app/avatar-embed/page.tsx
"use client";

import React, { useEffect, useState } from "react";

/**
 * EFRO Avatar Embed Test Page
 * --------------------------------
 * Diese Seite dient nur zur Vorschau des Avatars.
 * Sie ist kein API-Endpunkt, sondern eine visuelle Testumgebung.
 */
export default function AvatarEmbedPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Beispiel: simuliert Laden des Avatars
    const timer = setTimeout(() => setLoaded(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main
      style={{
        fontFamily: "Inter, Arial, sans-serif",
        padding: "40px",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f9fafb 0%, #eef2f7 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#222",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
        ?? EFRO Avatar Preview
      </h1>

      {!loaded ? (
        <p style={{ opacity: 0.6 }}>Avatar wird geladen...</p>
      ) : (
        <div
          style={{
            width: 320,
            height: 320,
            borderRadius: "16px",
            background: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
          }}
        >
          ??? EFRO Avatar läuft!
        </div>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.9rem", opacity: 0.7 }}>
        Diese Seite dient nur als lokale Vorschau.
        <br />
        Die Produktdaten werden über <code>/api/shopify-products</code> geladen.
      </p>
    </main>
  );
}


