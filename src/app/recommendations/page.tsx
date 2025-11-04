"use client";
import { useState } from "react";

export default function RecommendationsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
     const res = await fetch("/api/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const data = await res.json();
console.log("🔍 API-Antwort:", data);


      if (data.ok) {
        setResults(data.results || []);
      } else {
        setError(data.error || "Unbekannter Fehler");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "40px", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "10px" }}>
        🧠 Produkt-Suche testen
      </h1>
      <p style={{ marginBottom: "20px", color: "#555" }}>
        Gib eine Suchanfrage ein (z. B. „weißes T-Shirt“ oder „Hoodie“) und
        sieh, was dein Avatar empfehlen würde.
      </p>

      <div style={{ display: "flex", gap: "10px", marginBottom: "30px" }}>
        <input
          type="text"
          value={query}
          placeholder="Was suchst du?"
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            padding: "10px",
            fontSize: "1rem",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            backgroundColor: "#0070f3",
            color: "white",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "Suche..." : "Suchen"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>⚠️ {error}</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
        }}
      >
        {results.map((p) => (
          <div
            key={p.sku}
            style={{
              border: "1px solid #eee",
              borderRadius: "12px",
              padding: "16px",
              boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
              backgroundColor: "white",
            }}
          >
            <img
              src={p.image_url}
              alt={p.title}
              style={{
                width: "100%",
                borderRadius: "8px",
                marginBottom: "12px",
              }}
            />
            <h3 style={{ fontSize: "1.1rem", marginBottom: "6px" }}>
              {p.title}
            </h3>
            <p
              style={{
                color: "#666",
                fontSize: "0.9rem",
                minHeight: "40px",
                marginBottom: "10px",
              }}
            >
              {p.description}
            </p>
            <p style={{ fontWeight: "bold", color: "#0070f3" }}>
              {p.price?.toFixed(2)} €
            </p>
            <a
              href={p.product_url}
              target="_blank"
              style={{
                display: "inline-block",
                marginTop: "10px",
                background: "#0070f3",
                color: "white",
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: "6px",
              }}
            >
              Zum Produkt →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
