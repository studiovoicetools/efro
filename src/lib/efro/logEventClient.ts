// src/lib/efro/logEventClient.ts
"use client";

export type EfroEventLogInput = {
  shopDomain: string;
  userText: string;
  intent: string;
  productCount?: number;
  plan?: string | null;
  hadError?: boolean;
  errorMessage?: string | null;
};

/**
 * Fire-and-forget Logging-Helper.
 * Kann aus jeder Client-Komponente (z. B. avatar-seller/page.tsx) aufgerufen werden.
 */
export async function logEfroEvent(input: EfroEventLogInput): Promise<void> {
  try {
    await fetch("/api/efro/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // bewusst kein await im Aufrufer nötig – hier aber schon, damit Fehler sauber geloggt werden können
      body: JSON.stringify(input),
      keepalive: true, // hilft, wenn der Tab kurz danach geschlossen wird
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[EFRO logEfroEvent] Logging failed (ignored in UI)", err);
    }
    // Fehler werden bewusst geschluckt – der Avatar darf NIE wegen Logging abbrechen
  }
}
