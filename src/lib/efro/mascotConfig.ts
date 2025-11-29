/**
 * EFRO Mascot/Avatar-Konfiguration
 * Zentrale Logik für Avatar-URL-Generierung
 */

export type EfroAvatarId =
  | "bear"
  | "cat"
  | "cyberGirl"
  | "mascotCat"
  | "notionGuys"
  | "realisticFemale"
  | "retroBot";

/**
 * Baut die Mascot-URL basierend auf avatarId
 * 
 * @param avatarId - Optional: Avatar-ID (z.B. "bear", "cat", "retroBot")
 * @returns URL-Pfad zur .riv-Datei (z.B. "/retroBot.riv")
 * 
 * Aktuell: Gibt immer "/retroBot.riv" zurück (wie bisher in avatar-seller).
 * Später: Kann avatarId-basierte URLs zurückgeben.
 */
export function buildMascotUrl(avatarId?: EfroAvatarId): string {
  // Aktuell: Gleiche Logik wie bisher in avatar-seller/page.tsx
  // Default ist "/retroBot.riv"
  const defaultUrl = "/retroBot.riv";

  // Wenn avatarId vorhanden ist, kann später hier die Logik erweitert werden
  if (avatarId) {
    // Mapping: avatarId -> .riv-Datei
    const avatarUrlMap: Record<EfroAvatarId, string> = {
      bear: "/bear.riv",
      cat: "/cat.riv",
      cyberGirl: "/cyberGirl.riv",
      mascotCat: "/mascotCat.riv",
      notionGuys: "/notionGuys.riv",
      realisticFemale: "/realisticFemale.riv",
      retroBot: "/retroBot.riv",
    };

    return avatarUrlMap[avatarId] || defaultUrl;
  }

  // Fallback: bisherige Default-URL
  return defaultUrl;
}

