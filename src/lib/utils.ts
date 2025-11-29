/**
 * Utility-Funktion zum Zusammenführen von CSS-Klassen
 * Einfache Implementierung ohne externe Dependencies
 */
export function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs
    .filter((input) => input != null && typeof input !== "boolean")
    .join(" ");
}

