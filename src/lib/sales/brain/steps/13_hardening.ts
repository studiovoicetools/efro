// src/lib/sales/brain/steps/13_hardening.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

export async function runStep13_Hardening(context: SellerBrainContext): Promise<void> {
  const errors: string[] = [];

  // Input text pruefen
  if (!context.inputText || typeof context.inputText !== "string" || context.inputText.trim().length === 0) {
    errors.push("Missing or invalid inputText");
  }

  // Katalog pruefen (legacy: context.products, neu: context.catalog)
  const products = Array.isArray(context.products)
    ? context.products
    : Array.isArray(context.catalog)
      ? context.catalog
      : [];
  if (products.length === 0) {
    errors.push("No products in context");
  }

  // Kategorie validieren
  if (context.category && typeof context.category !== "string") {
    errors.push("Invalid category type");
  }

  // Empfohlene Produkte pruefen
  if (context.recommendedProducts && !Array.isArray(context.recommendedProducts)) {
    errors.push("Recommended products must be an array");
  }

  // Bei Fehler: Flags setzen
  if (errors.length > 0) {
    context.flags = context.flags || {};

    // invalidInput NUR, wenn der User-Input wirklich kaputt/leer ist
    const hasInputError = errors.some((e) => e.toLowerCase().includes("inputtext"));
    if (hasInputError) {
      context.flags.invalidInput = true;
    } else {
      // Sonst: interner Zustand/Schema (z.B. Produkte/Typen) -> NICHT "invalid"
      context.flags.internalError = true;
    }

    if (context.debugMode) {
      if (!context.debug) {
        context.debug = [];
      }
      context.debug.push({
        step: "hardening",
        note: hasInputError ? "Invalid user input" : "Internal validation issue",
        errors,
      });
    }
  }
}
