"use client";
import React, { useState } from "react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  const handleUpload = async () => {
    if (!file) {
      setStatus("âŒ Bitte zuerst eine CSV-Datei auswÃ¤hlen.");
      return;
    }

    setStatus("â³ Wird hochgeladen...");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.ok) {
        setStatus(`âœ… Erfolgreich: ${data.inserted} neu, ${data.updated} aktualisiert.`);
      } else {
        setStatus(`âš ï¸ Teilweise Fehler: ${data.errors?.length || 0} fehlerhafte Zeilen.`);
        console.warn(data.errors);
      }
    } catch (err) {
      console.error(err);
      setStatus("âŒ Upload fehlgeschlagen. Siehe Konsole fÃ¼r Details.");
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>ğŸ—‚ï¸ Produkt-Import</h1>
      <p>WÃ¤hle deine <b>products.csv</b> Datei und lade sie hoch.</p>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={handleUpload}
        style={{ marginLeft: 10, padding: "6px 12px" }}
      >
        Hochladen
      </button>

      <p style={{ marginTop: 20 }}>{status}</p>
    </div>
  );
}

