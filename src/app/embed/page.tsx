// src/app/embed/page.tsx
import React from "react";

export const dynamic = "force-static";

export default function EmbedPage() {
  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        backgroundColor: "#000",
        color: "#fff",
        height: "100vh",
        textAlign: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Meet EFRO 🐼</h1>
      <p>Dein smarter Verkaufsassistent ist bereit.</p>

      <button
        onClick={() => alert("EFRO aktiviert – Avatar startet!")}
        style={{
          marginTop: 20,
          background: "#00bcd4",
          border: "none",
          borderRadius: "8px",
          padding: "14px 28px",
          color: "#fff",
          fontSize: "18px",
          cursor: "pointer",
        }}
      >
        Mit EFRO sprechen
      </button>
    </main>
  );
}
