// src/lib/sales/brain/steps/13_hardening.ts

import { SellerBrainContext } from "../../types";

export async function runStep13_Hardening(context: SellerBrainContext): Promise<void> {
  const errors: string[] = [];

  // Input text pruefen
  if (!context.inputText || typeof context.inputText !== "string" || context.inputText.trim().length === 0) {
    errors.push("Missing or invalid inputText");
  }

  // Katalog pruefen
  if (!Array.isArray(context.products) || context.products.length === 0) {
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

  // Bei Fehler: Flag setzen
  if (errors.length > 0) {
    context.flags = context.flags || {};
    context.flags.invalidInput = true;

    if (context.debugMode) {
      if (!context.debug) {
        context.debug = [];
      }
      context.debug.push({
        step: "hardening",
        note: "Input validation errors",
        errors,
      });
    }
  }
}
