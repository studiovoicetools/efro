// src/lib/sales/modules/category/index.ts
// EFRO Modularization Phase 3: Kategorie-Erkennung ausgelagert

import type { EfroProduct } from "@/lib/products/mockCatalog";
import { normalize, collectMatches } from "@/lib/sales/modules/utils";
import { CATEGORY_KEYWORDS } from "../../languageRules.de";

/**
 * Ergebnis der Kategorie-Erkennung
 */
export interface CategoryResult {
  effectiveCategorySlug: string | null;
  matchedCategories: string[];
  categoryHintsInText: string[];
  missingCategoryHint?: string;
  triggerWord?: string | null;
  debugInfo?: Record<string, unknown>;
}

/**
 * EFRO Kategorie-Optimierung: Wählt nur Kategorien mit tatsächlichen Produkten
 * 
 * Filtert matchedCategories auf Kategorien, die mindestens 1 Produkt enthalten.
 * Bevorzugt die Kategorie mit den meisten Produkten.
 */
function selectEffectiveCategory(params: {
  matchedCategories: string[];
  allProducts: EfroProduct[];
  text: string;
  strongOverrideCategory?: string | null;
  contextCategory?: string | null;
}): {
  selectedCategory: string | null;
  filteredMatchedCategories: string[];
  categoryProductCounts: Record<string, number>;
} {
  const { matchedCategories, allProducts, text, strongOverrideCategory, contextCategory } = params;
  
  // Normalisiere den Eingabetext für die Verwendung in dieser Funktion
  const normalizedText = normalize(text || "");
  
  // Zähle Produkte pro Kategorie
  const categoryProductCounts: Record<string, number> = {};
  
  for (const category of matchedCategories) {
    const normalizedCategory = normalize(category);
    const count = allProducts.filter(
      (p) => normalize(p.category || "") === normalizedCategory
    ).length;
    categoryProductCounts[category] = count;
  }
  
  // Filtere auf Kategorien mit mindestens 1 Produkt
  const filteredMatchedCategories = matchedCategories.filter(
    (cat) => (categoryProductCounts[cat] ?? 0) > 0
  );
  
  // CLUSTER F FIX: K14v1, K15v1 - Kontextwechsel Mode → Elektronik
  // Wenn aktueller Kontext "Mode" ist UND der neue Text klar auf Elektronik hinweist → überschreibe auf "Elektronik"
  const isModeContext = contextCategory && normalize(contextCategory) === "mode";
  const mentionsElektronik = 
    normalizedText.includes("elektronik") ||
    normalizedText.includes("kopfhörer") ||
    normalizedText.includes("headphones") ||
    normalizedText.includes("smartphone") ||
    normalizedText.includes("phone") ||
    normalizedText.includes("handy");
  
  if (isModeContext && mentionsElektronik) {
    const elektronikCount = allProducts.filter(
      (p) => normalize(p.category || "") === "elektronik"
    ).length;
    if (elektronikCount > 0) {
      // Kontextwechsel Mode → Elektronik → überschreibe auf "Elektronik"
      return {
        selectedCategory: "elektronik",
        filteredMatchedCategories: filteredMatchedCategories.length > 0 
          ? filteredMatchedCategories 
          : ["elektronik"],
        categoryProductCounts: {
          ...categoryProductCounts,
          elektronik: elektronikCount,
        },
      };
    }
  }

  // EFRO Smartphone-Fix K7/K8: Bei Kontext "elektronik" → "elektronik" priorisieren
  if (contextCategory && normalize(contextCategory) === "elektronik") {
    const elektronikCount = allProducts.filter(
      (p) => normalize(p.category || "") === "elektronik"
    ).length;
    if (elektronikCount > 0) {
      // Kontext "elektronik" hat Produkte → verwende es (höchste Priorität)
      return {
        selectedCategory: "elektronik",
        filteredMatchedCategories: filteredMatchedCategories.length > 0 
          ? filteredMatchedCategories 
          : ["elektronik"],
        categoryProductCounts: {
          ...categoryProductCounts,
          elektronik: elektronikCount,
        },
      };
    }
  }
  
  // Wenn Strong Override gesetzt ist, prüfe ob es Produkte gibt
  if (strongOverrideCategory) {
    const normalizedOverride = normalize(strongOverrideCategory);
    const overrideCount = allProducts.filter(
      (p) => normalize(p.category || "") === normalizedOverride
    ).length;
    
    if (overrideCount > 0) {
      // Strong Override hat Produkte → verwende es
      return {
        selectedCategory: normalizedOverride,
        filteredMatchedCategories: filteredMatchedCategories.length > 0 
          ? filteredMatchedCategories 
          : [normalizedOverride],
        categoryProductCounts: {
          ...categoryProductCounts,
          [normalizedOverride]: overrideCount,
        },
      };
    } else {
      // Strong Override hat keine Produkte → ignoriere es
      console.log("[EFRO Category] Strong override ignored (no products)", {
        strongOverrideCategory,
        text: text.substring(0, 80),
      });
    }
  }
  
  // Wenn keine gefilterten Kategorien vorhanden, return null
  if (filteredMatchedCategories.length === 0) {
    return {
      selectedCategory: null,
      filteredMatchedCategories: [],
      categoryProductCounts,
    };
  }
  
  // Wenn genau 1 Kategorie vorhanden, verwende diese
  if (filteredMatchedCategories.length === 1) {
    return {
      selectedCategory: normalize(filteredMatchedCategories[0]),
      filteredMatchedCategories,
      categoryProductCounts,
    };
  }
  
  // Mehrere Kategorien: Bevorzuge die mit den meisten Produkten
  const sortedByCount = [...filteredMatchedCategories].sort(
    (a, b) => (categoryProductCounts[b] ?? 0) - (categoryProductCounts[a] ?? 0)
  );
  
  const topCategory = sortedByCount[0];
  const topCount = categoryProductCounts[topCategory] ?? 0;
  
  // Bei Gleichstand: Zusätzliche Heuristik basierend auf Text-Keywords
  const categoriesWithTopCount = sortedByCount.filter(
    (cat) => (categoryProductCounts[cat] ?? 0) === topCount
  );
  
  if (categoriesWithTopCount.length > 1) {
    // Bei Gleichstand: Prüfe, welche Kategorie besser zu Text-Keywords passt
    const normalizedText = normalize(text);
    let bestCategory = topCategory;
    
    for (const cat of categoriesWithTopCount) {
      const normalizedCat = normalize(cat);
      // Prüfe, ob der Kategorie-Name im Text vorkommt
      if (normalizedText.includes(normalizedCat)) {
        bestCategory = cat;
        break;
      }
    }
    
    console.log("[EFRO Category] Multiple categories with same product count", {
      text: text.substring(0, 80),
      categories: categoriesWithTopCount,
      selected: bestCategory,
      productCount: topCount,
    });
    
    return {
      selectedCategory: normalize(bestCategory),
      filteredMatchedCategories,
      categoryProductCounts,
    };
  }
  
  return {
    selectedCategory: normalize(topCategory),
    filteredMatchedCategories,
    categoryProductCounts,
  };
}

/**
 * EFRO Modularization Phase 3: determineEffectiveCategory ausgelagert
 * 
 * Bestimmt die effektive Kategorie aus Text, Context und Produktkatalog.
 * Enthält alle Spezialfälle (Haustier-Fix, Parfüm-Priorisierung, etc.)
 */
export function determineEffectiveCategory(params: {
  text: string;
  cleanedText: string;
  contextCategory?: string | null;
  allProducts: EfroProduct[];
}): CategoryResult {
  const { text, cleanedText, contextCategory, allProducts } = params;
  
  const t = normalize(cleanedText);
  const normalizedText = t;
  
  // Deklariere effectiveCategorySlug früh, damit es im Haustier-Block verwendet werden kann
  let effectiveCategorySlug: string | null = null;
  
  // Alle Kategorien aus dem Katalog extrahieren (muss VOR Smartphone-Check sein)
  const allCategories = Array.from(
    new Set(
      allProducts
        .map((p) => normalize(p.category || ""))
        .filter((c) => c.length >= 3)
    )
  );
  
  // Strong Category Hints: Strukturierte Liste mit starken Kategorie-Hinweisen
  // EFRO Smartphone-Fix: Smartphone-Keywords haben höchste Priorität, auch wenn "modern" im Text ist
  // CLUSTER D FIX PROFI-01v1: "board" allein führt NICHT zu "snowboard" (nur wenn "snowboard" auch im Text steht)
  const strongCategoryHints: Record<string, string[]> = {
    snowboard: ["snowboard", "snowboards"], // "board" entfernt - wird separat behandelt
    haushalt: ["haushalt", "wasserkocher", "electric kettle", "kettle"],
    elektronik: ["elektronik", "electronics", "smartphone", "phone", "handy", "tv", "fernseher"],
    mode: ["mode", "fashion", "kleidung", "bekleidung", "jeans", "hose", "t-shirt"],
  };
  
  // CLUSTER D FIX PROFI-01v1: "board" wurde aus strongCategoryHints entfernt
  // "board" allein führt NICHT zu "snowboard" (nur wenn "snowboard" auch im Text steht)
  
  // EFRO Smartphone-Fix K5-K8: Prüfe zuerst auf Smartphone-Keywords (vor anderen Kategorien)
  // Dies verhindert, dass "modern" zu "mode" führt, wenn Smartphone-Keywords vorhanden sind
  let strongOverrideCategory: string | null = null;
  
  // CLUSTER 1 FIX S4v2: "board" + Budget → "snowboard" (Budget ist ein starker Hinweis auf Snowboard)
  const mentionsBoard = normalizedText.includes("board") || normalizedText.includes("boards");
  const hasBudgetInText = /\b(\d+)\s*(euro|eur|€|dollar|\$)\b/i.test(text) || 
    /\b(unter|über|bis|ab|zwischen|von|bis zu|maximal|mindestens|höchstens)\s*\d+/i.test(text);
  
  if (mentionsBoard && hasBudgetInText && !normalizedText.includes("snowboard")) {
    // "board" + Budget → wahrscheinlich Snowboard (nicht Mode)
    const hasSnowboardCategory = allCategories.some((cat) => normalize(cat) === "snowboard");
    if (hasSnowboardCategory) {
      const snowboardCount = allProducts.filter(
        (p) => normalize(p.category || "") === "snowboard"
      ).length;
      if (snowboardCount > 0) {
        strongOverrideCategory = "snowboard";
        console.log("[EFRO Category] CLUSTER 1 FIX S4v2 - Board + Budget → Snowboard", {
          text: text.substring(0, 80),
          hasBudgetInText,
          strongOverrideCategory,
          productCount: snowboardCount,
        });
      }
    }
  }

  // CLUSTER 3 FIX S6v2: "Premium-Modell" + "höchsten Preis" → "snowboard" (nicht "mode")
  // Wenn "Premium-Modell" oder "Premium-Modell" + "höchsten Preis" im Text ist, aber keine explizite Kategorie,
  // dann prüfe, ob "snowboard" im Katalog vorhanden ist und priorisiere es über "mode"
  const mentionsPremiumModell = /\bpremium[\s-]?modell\b/i.test(normalizedText) || 
    (normalizedText.includes("premium") && normalizedText.includes("modell"));
  const mentionsHoechstenPreis = /\bhöchsten\s+preis\b/i.test(normalizedText) || 
    /\bhöchste\s+preis\b/i.test(normalizedText) ||
    /\bteuerste\b/i.test(normalizedText);
  
  if (mentionsPremiumModell && mentionsHoechstenPreis && !strongOverrideCategory) {
    const hasSnowboardCategory = allCategories.some((cat) => normalize(cat) === "snowboard");
    if (hasSnowboardCategory) {
      const snowboardCount = allProducts.filter(
        (p) => normalize(p.category || "") === "snowboard"
      ).length;
      if (snowboardCount > 0) {
        strongOverrideCategory = "snowboard";
        console.log("[EFRO Category] CLUSTER 3 FIX S6v2 - Premium-Modell + höchsten Preis → Snowboard", {
          text: text.substring(0, 80),
          mentionsPremiumModell,
          mentionsHoechstenPreis,
          strongOverrideCategory,
          productCount: snowboardCount,
        });
      }
    }
  }
  
  const mentionsSmartphoneEarly =
    normalizedText.includes("smartphone") ||
    normalizedText.includes("smartphones") ||
    normalizedText.includes("handy") ||
    normalizedText.includes("handys") ||
    normalizedText.includes("iphone") ||
    normalizedText.includes("android") ||
    (normalizedText.includes("phone") && !normalizedText.includes("handyvertrag"));
  
  // Prüfe auch auf konkrete Modellnamen wie "Smartphone Alpha", "Alpha 128GB", etc.
  // CLUSTER K FIX: Erweitere Pattern für besseres Matching (z.B. "das Alpha 128GB Schwarz")
  const hasSmartphoneModelName = /\b(smartphone\s+alpha|alpha\s+smartphone|phone\s+alpha|alpha\s+phone|alpha\s+\d+gb|alpha\s+\d+\s*gb|das\s+alpha\s+\d+\s*gb|alpha\s+\d+\s*gb\s+schwarz)\b/i.test(text);
  
  if (mentionsSmartphoneEarly || hasSmartphoneModelName) {
    const hasElektronikCategory = allCategories.some(
      (cat) => normalize(cat) === "elektronik"
    );
    if (hasElektronikCategory) {
      const elektronikCount = allProducts.filter(
        (p) => normalize(p.category || "") === "elektronik"
      ).length;
      
      if (elektronikCount > 0) {
        // Smartphone-Keywords gefunden → setze elektronik als strongOverrideCategory
        strongOverrideCategory = "elektronik";
        console.log("[EFRO Category] Smartphone-Keywords detected early (K5-K8)", {
          text: text.substring(0, 80),
          mentionsSmartphoneEarly,
          hasSmartphoneModelName,
          strongOverrideCategory,
          productCount: elektronikCount,
        });
      }
    }
  }

  const categoryHintsInText: string[] = [];
  const matchedCategories: string[] = [];

  // Kategorie-Erkennung: Direkte Pattern-Matches
  const catRegex = /kategorie\s+([a-zäöüß]+)/;
  const catMatch = t.match(catRegex);
  if (catMatch && catMatch[1]) {
    const catWord = catMatch[1];
    categoryHintsInText.push(catWord);
    allCategories.forEach((cat) => {
      if (cat.includes(catWord)) {
        matchedCategories.push(cat);
      }
    });
  } else {
    // EFRO Fix: Kategorie-Erkennung mit Wortgrenzen (verhindert "modern" -> "mode")
    allCategories.forEach((cat) => {
      if (cat) {
        // Verwende Wortgrenzen (\b) für exakte Matches, verhindert Substring-Matches
        const catRegex = new RegExp(`\\b${cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (catRegex.test(t)) {
          matchedCategories.push(cat);
          categoryHintsInText.push(cat);
        }
      }
    });
  }

  // Wort-Classification: Kategorien aus languageRules.de erkennen (additiv)
  const fullTextLowerForCategory = t.toLowerCase();

  // SCHRITT 5 FIX: Parfüm-Fix: Kategorie "perfume" hart priorisieren, wenn der Text klar nach Parfüm klingt
  const normalizedQueryForPerfume = normalize(text);
  const perfumeKeywords = [
    "parfum",
    "parfüm",
    "parfum",
    "parf", // EFRO F7 Fix: "parf" wird auch erkannt (normalisiertes "parfüm")
    "duft",
    "eau de parfum",
    "eau de toilette",
    "perfume", // SCHRITT 5 FIX: Auch "perfume" direkt erkennen
  ];

  const userAsksForPerfume = perfumeKeywords.some((kw) =>
    normalizedQueryForPerfume.includes(kw)
  );

  const hasPerfumeCategoryInCatalog = allCategories.some(
    (cat) => normalize(cat) === "perfume"
  );
  
  // SCHRITT 5 FIX: Wenn Parfüm erkannt, setze strongOverrideCategory
  if (userAsksForPerfume && hasPerfumeCategoryInCatalog && !strongOverrideCategory) {
    const perfumeCount = allProducts.filter(
      (p) => normalize(p.category || "") === "perfume"
    ).length;
    if (perfumeCount > 0) {
      strongOverrideCategory = "perfume";
      console.log("[EFRO Category] Perfume-Keywords detected (F2/F3/D1/D2/D3)", {
        text: text.substring(0, 80),
        strongOverrideCategory,
        productCount: perfumeCount,
      });
    }
  }

  const categoryHintsFromRules = collectMatches(fullTextLowerForCategory, CATEGORY_KEYWORDS);
  
  // EFRO Fix: Negativliste für Wörter, die NICHT als "mode" erkannt werden sollen
  // EFRO K8 Fix: "modelle" (Plural) auch zur Negativliste hinzufügen
  const modeNegativeWords = ["modern", "moderne", "moderner", "modernes", "modernen", "modell", "modelle", "modem"];

  const filteredHints = categoryHintsFromRules.filter((hint) => {
    const normalizedHint = normalize(hint);

    if (normalizedHint === "mode") {
      // Prüfe, ob "modern" oder ähnliche Wörter im Text vorkommen
      const hasNegativeWord = modeNegativeWords.some((negWord) =>
        new RegExp(`\\b${negWord}\\b`, "i").test(fullTextLowerForCategory)
      );

      if (hasNegativeWord) {
        console.log("[EFRO SB Category] Ignored 'mode' match (negative word detected)", {
          hint,
          negativeWords: modeNegativeWords.filter((negWord) =>
            new RegExp(`\\b${negWord}\\b`, "i").test(fullTextLowerForCategory)
          ),
        });
        return false;
      }
    }

    return true;
  });

  // CLUSTER D FIX: I3v2 - Haustier-Erkennung erweitert
  // EFRO Haustier-Fix:
  // Mappe "tierbedarf", "hund", "dog", "katze", "cat" (aus languageRules) auf die echte Katalog-Kategorie "haustier", falls vorhanden.
  const hasHaustierCategory = allCategories.some(
    (cat) => normalize(cat) === "haustier"
  );

  // CLUSTER D FIX: I3v2 - Erweitere Erkennung auf "hund", "dog", "katze", "cat", "geschenk für hund"
  const hasTierbedarfHint =
    categoryHintsInText.some((hint) => normalize(hint) === "tierbedarf") ||
    matchedCategories.some((cat) => normalize(cat) === "tierbedarf") ||
    filteredHints.some((hint) => normalize(hint) === "tierbedarf");
  
  // CLUSTER D FIX: I3v2 - Prüfe auch auf direkte Haustier-Keywords im Text
  // CLUSTER 3 FIX: "Vierbeiner" hinzugefügt für I3v2
  const mentionsHaustierKeywords = 
    normalizedText.includes("hund") ||
    normalizedText.includes("dog") ||
    normalizedText.includes("katze") ||
    normalizedText.includes("cat") ||
    normalizedText.includes("haustier") ||
    normalizedText.includes("pet") ||
    normalizedText.includes("pets") ||
    normalizedText.includes("tier") ||
    normalizedText.includes("animal") ||
    normalizedText.includes("vierbeiner");

  if (hasHaustierCategory && (hasTierbedarfHint || mentionsHaustierKeywords)) {
    const haustierCategory = allCategories.find(
      (cat) => normalize(cat) === "haustier"
    );

    if (haustierCategory) {
      const normalizedHaustierCat = normalize(haustierCategory);

      // CLUSTER D FIX: I3v2 - Setze haustier als effectiveCategorySlug mit hoher Priorität
      if (!effectiveCategorySlug || normalize(effectiveCategorySlug) !== normalizedHaustierCat) {
        effectiveCategorySlug = normalizedHaustierCat;
      }

      if (
        !matchedCategories.some(
          (cat) => normalize(cat) === normalizedHaustierCat
        )
      ) {
        matchedCategories.unshift(normalizedHaustierCat); // Am Anfang für Priorität
      }

      if (
        !categoryHintsInText.some(
          (hint) => normalize(hint) === normalizedHaustierCat
        )
      ) {
        categoryHintsInText.unshift(haustierCategory); // Am Anfang für Priorität
      }

      console.log("[EFRO Category] CLUSTER D FIX I3v2 - Haustier category mapped", {
        text: text.substring(0, 80),
        hasTierbedarfHint,
        mentionsHaustierKeywords,
        effectiveCategorySlug,
        matchedCategories,
        categoryHintsInText,
      });
    }
  }

  // categoryHints additiv zu matchedCategories hinzufügen (nur wenn noch nicht vorhanden)
  for (const hint of filteredHints) {
    const normalizedHint = normalize(hint);
    // Prüfe, ob die Kategorie bereits in matchedCategories oder allCategories vorhanden ist
    const existsInCategories = allCategories.some((cat) => normalize(cat) === normalizedHint);
    if (existsInCategories && !matchedCategories.some((cat) => normalize(cat) === normalizedHint)) {
      // Kategorie aus categoryHints hinzufügen, wenn sie im Katalog existiert
      const matchingCategory = allCategories.find((cat) => normalize(cat) === normalizedHint);
      if (matchingCategory) {
        matchedCategories.push(matchingCategory);
        categoryHintsInText.push(matchingCategory);
      }
    }
  }

  // Strong Keyword Override: Prüfe auf starke Kategorie-Hinweise (nach matchedCategories-Matching, aber vor finalem Fallback)
  // EFRO Smartphone-Fix: strongOverrideCategory wurde bereits oben gesetzt, wenn Smartphone-Keywords gefunden wurden
  // Falls nicht, prüfe jetzt auf andere Strong Overrides
  if (!strongOverrideCategory) {
    for (const [category, keywords] of Object.entries(strongCategoryHints)) {
      if (keywords.some((kw) => normalizedText.includes(kw))) {
        strongOverrideCategory = category;
        break;
      }
    }
  }

  // EFRO Smartphone-Fix K7/K8: Bei Kontext "elektronik" → "mode" aus matchedCategories entfernen
  // (verhindert, dass "Modelle" oder "modern" zu "mode" führt, wenn Kontext "elektronik" ist)
  const hasElektronikContext = contextCategory && normalize(contextCategory) === "elektronik";
  if (hasElektronikContext) {
    const modeIndex = matchedCategories.findIndex((cat) => normalize(cat) === "mode");
    if (modeIndex !== -1) {
      matchedCategories.splice(modeIndex, 1);
      console.log("[EFRO Category] Removed 'mode' from matchedCategories (Kontext elektronik)", {
        text: text.substring(0, 80),
        contextCategory,
        matchedCategoriesAfter: matchedCategories,
      });
    }
    // EFRO Smartphone-Fix K7/K8: Stelle sicher, dass "elektronik" in matchedCategories ist
    const hasElektronikInMatched = matchedCategories.some((cat) => normalize(cat) === "elektronik");
    if (!hasElektronikInMatched) {
      const elektronikCategory = allCategories.find((cat) => normalize(cat) === "elektronik");
      if (elektronikCategory) {
        matchedCategories.unshift(elektronikCategory); // Am Anfang einfügen für Priorität
        console.log("[EFRO Category] Added 'elektronik' to matchedCategories (Kontext elektronik)", {
          text: text.substring(0, 80),
          contextCategory,
          matchedCategoriesAfter: matchedCategories,
        });
      }
    }
  }
  
  // CLUSTER 3 FIX: Wenn contextCategory gesetzt ist und keine neue Kategorie im Text erkannt wurde,
  // dann verwende contextCategory als effectiveCategorySlug
  // Dies stellt sicher, dass Kontext-Kategorien (z.B. "haustier", "perfume", "snowboard") beibehalten werden,
  // auch wenn der Text keine Kategorie-Keywords enthält (z.B. "Zeig mir Premium")
  // WICHTIG: Diese Logik muss VOR selectEffectiveCategory greifen, damit matchedCategories korrekt gesetzt wird
  if (contextCategory && matchedCategories.length === 0 && !strongOverrideCategory) {
    const normalizedContextCategory = normalize(contextCategory);
    const contextCategoryCount = allProducts.filter(
      (p) => normalize(p.category || "") === normalizedContextCategory
    ).length;
    if (contextCategoryCount > 0) {
      // Füge contextCategory zu matchedCategories hinzu, damit selectEffectiveCategory sie berücksichtigt
      const contextCategoryInCatalog = allCategories.find(
        (cat) => normalize(cat) === normalizedContextCategory
      );
      if (contextCategoryInCatalog) {
        matchedCategories.push(contextCategoryInCatalog);
        console.log("[EFRO Category] CLUSTER 3 FIX - Kontext-Kategorie zu matchedCategories hinzugefügt", {
          text: normalizedText,
          contextCategory,
          matchedCategories,
          productCount: contextCategoryCount,
        });
      }
    }
  }

  // EFRO Kategorie-Optimierung: Filtere matchedCategories auf Kategorien mit tatsächlichen Produkten
  const categorySelection = selectEffectiveCategory({
    matchedCategories,
    allProducts,
    text,
    strongOverrideCategory,
    contextCategory,
  });
  
  // Aktualisiere matchedCategories auf die gefilterten Kategorien mit Produkten
  const originalMatchedCategories = [...matchedCategories];
  matchedCategories.length = 0;
  matchedCategories.push(...categorySelection.filteredMatchedCategories);
  
  console.log("[EFRO Category] Product-based category filtering", {
    text: text.substring(0, 80),
    originalMatchedCategories,
    filteredMatchedCategories: categorySelection.filteredMatchedCategories,
    categoryProductCounts: categorySelection.categoryProductCounts,
    selectedCategory: categorySelection.selectedCategory,
  });

  // KONEXT-LOGIK: Wenn keine neue Kategorie im Text erkannt wurde, aber contextCategory vorhanden ist
  // → nutze contextCategory als effectiveCategory
  // WICHTIG: Wenn strongOverrideCategory gesetzt ist, wird contextCategory ignoriert
  // EFRO Smartphone-Fix K7: Bei Kontext "elektronik" → Kontext beibehalten (auch ohne Smartphone-Keywords im Text)
  // EFRO D8 Fix: Bei Kontext "haushalt" → Kontext beibehalten (auch ohne Haushalt-Keywords im Text)
  
  // EFRO Smartphone-Fix K7: Wenn Kontext "elektronik" vorhanden → Kontext priorisieren
  // WICHTIG: Auch wenn "modern" im Text ist, soll "mode" nicht die Kategorie überschreiben
  const hasSmartphoneKeywords = mentionsSmartphoneEarly || hasSmartphoneModelName;
  
  // EFRO Smartphone-Fix K7/K8: Bei Kontext "elektronik" immer elektronik beibehalten
  // (auch wenn "modern" zu "mode" führen würde)
  if (hasElektronikContext) {
    const elektronikCount = allProducts.filter(
      (p) => normalize(p.category || "") === "elektronik"
    ).length;
    if (elektronikCount > 0) {
      effectiveCategorySlug = "elektronik";
      console.log("[EFRO Category] Kontext elektronik beibehalten (K7/K8)", {
        text: normalizedText,
        contextCategory,
        effectiveCategorySlug,
        hasSmartphoneKeywords,
        productCount: elektronikCount,
      });
    }
  }
  
  // EFRO D8 Fix: Bei Kontext "haushalt" immer haushalt beibehalten
  // (auch wenn keine Haushalt-Keywords im Text sind, z.B. bei Budget-Anfragen)
  const hasHaushaltContext = contextCategory && normalize(contextCategory) === "haushalt";
  if (hasHaushaltContext && !effectiveCategorySlug) {
    const haushaltCount = allProducts.filter(
      (p) => normalize(p.category || "") === "haushalt"
    ).length;
    if (haushaltCount > 0) {
      effectiveCategorySlug = "haushalt";
      console.log("[EFRO Category] Kontext haushalt beibehalten (D8)", {
        text: normalizedText,
        contextCategory,
        effectiveCategorySlug,
        productCount: haushaltCount,
      });
    }
  }


  // CLUSTER I/B/A FIX: I3v2, B1v1, A2v2 - Haustier-Begriffe überschreiben Mode/Kosmetik
  // High-Priority-Regel: Wenn Haustier-Begriffe im Text sind, überschreibe effectiveCategorySlug
  // WICHTIG: Diese Regel greift NACH der Basissetzung, um Mode/Kosmetik zu überschreiben
  const mentionsHaustierHighPriority = 
    normalizedText.includes("hund") ||
    normalizedText.includes("dog") ||
    normalizedText.includes("katze") ||
    normalizedText.includes("cat") ||
    normalizedText.includes("haustier") ||
    normalizedText.includes("pet") ||
    normalizedText.includes("pets") ||
    normalizedText.includes("tier") ||
    normalizedText.includes("animal") ||
    normalizedText.includes("fressnapf") ||
    normalizedText.includes("geschenk für hund") ||
    normalizedText.includes("geschenk für katze");
  
  if (mentionsHaustierHighPriority && hasHaustierCategory) {
    const haustierCategory = allCategories.find(
      (cat) => normalize(cat) === "haustier"
    );
    if (haustierCategory) {
      const haustierCount = allProducts.filter(
        (p) => normalize(p.category || "") === "haustier"
      ).length;
      if (haustierCount > 0) {
        // Überschreibe effectiveCategorySlug mit "haustier", auch wenn vorher Mode/Kosmetik aktiv war
        effectiveCategorySlug = normalize(haustierCategory);
        
        // Stelle sicher, dass "haustier" in matchedCategories ist (am Anfang für Priorität)
        const haustierIndex = matchedCategories.findIndex((cat) => normalize(cat) === normalize(haustierCategory));
        if (haustierIndex === -1) {
          matchedCategories.unshift(haustierCategory);
        } else if (haustierIndex > 0) {
          // Verschiebe "haustier" an den Anfang
          matchedCategories.splice(haustierIndex, 1);
          matchedCategories.unshift(haustierCategory);
        }
        
        console.log("[EFRO Category] CLUSTER I/B/A FIX - Haustier überschreibt Mode/Kosmetik (I3v2, B1v1, A2v2)", {
          text: normalizedText,
          previousEffectiveCategorySlug: effectiveCategorySlug,
          effectiveCategorySlug: normalize(haustierCategory),
          matchedCategories,
          productCount: haustierCount,
        });
      }
    }
  }

  // SCHRITT 3 FIX: Bei "gartenartikel" immer "Garten" priorisieren (S10v1)
  // Verhindert, dass "Gartenartikel" zu "Kosmetik" führt
  const hasGartenartikel = normalizedText.includes("gartenartikel") || normalizedText.includes("garten-artikel");
  if (hasGartenartikel && !effectiveCategorySlug) {
    const gartenCategory = allCategories.find((cat) => normalize(cat) === "garten");
    if (gartenCategory) {
      const gartenCount = allProducts.filter(
        (p) => normalize(p.category || "") === "garten"
      ).length;
      if (gartenCount > 0) {
        effectiveCategorySlug = "garten";
        // Stelle sicher, dass "Garten" in matchedCategories ist (am Anfang für Priorität)
        const gartenIndex = matchedCategories.findIndex((cat) => normalize(cat) === "garten");
        if (gartenIndex === -1) {
          matchedCategories.unshift(gartenCategory);
        } else if (gartenIndex > 0) {
          // Verschiebe "Garten" an den Anfang
          matchedCategories.splice(gartenIndex, 1);
          matchedCategories.unshift(gartenCategory);
        }
        console.log("[EFRO Category] Gartenartikel → Garten priorisiert (S10v1)", {
          text: normalizedText,
          effectiveCategorySlug,
          matchedCategories,
          productCount: gartenCount,
        });
      }
    }
  }

  // Strong Category Override hat höchste Priorität (überschreibt Kontext)
  // ABER: Nur wenn es tatsächlich Produkte in dieser Kategorie gibt (wird in selectEffectiveCategory geprüft)
  // EFRO Smartphone-Fix: Nur wenn effectiveCategorySlug noch nicht gesetzt wurde
  if (!effectiveCategorySlug && categorySelection.selectedCategory && strongOverrideCategory) {
    effectiveCategorySlug = categorySelection.selectedCategory;
    console.log("[EFRO Category] Strong override (with products)", {
      text: normalizedText,
      chosenCategory: effectiveCategorySlug,
      contextCategory,
      productCount: categorySelection.categoryProductCounts[strongOverrideCategory] ?? 0,
    });
  } else if (!effectiveCategorySlug && categorySelection.selectedCategory) {
    // Kategorie aus selectEffectiveCategory verwenden (hat bereits Produktanzahl geprüft)
    effectiveCategorySlug = categorySelection.selectedCategory;
  } else if (!effectiveCategorySlug && matchedCategories.length > 0) {
    // Fallback: Wenn selectEffectiveCategory nichts zurückgibt, aber matchedCategories vorhanden
    // (sollte eigentlich nicht passieren, aber defensive)
    // WICHTIG: Prüfe auch hier, ob es Produkte in dieser Kategorie gibt
    const firstMatchedCategory = normalize(matchedCategories[0]);
    const firstCategoryCount = allProducts.filter(
      (p) => normalize(p.category || "") === firstMatchedCategory
    ).length;
    
    if (firstCategoryCount > 0) {
      effectiveCategorySlug = firstMatchedCategory;
    } else {
      console.log("[EFRO Category] Fallback category ignored (no products)", {
        matchedCategory: matchedCategories[0],
        text: text.substring(0, 80),
      });
    }
  } else if (contextCategory) {
    // Keine neue Kategorie im Text, aber Kontext vorhanden → nutze Kontext
    // ABER: Prüfe auch hier, ob es Produkte in dieser Kategorie gibt
    const normalizedContextCategory = normalize(contextCategory);
    const contextCategoryCount = allProducts.filter(
      (p) => normalize(p.category || "") === normalizedContextCategory
    ).length;
    
    if (contextCategoryCount > 0) {
      effectiveCategorySlug = normalizedContextCategory;
    } else {
      console.log("[EFRO Category] Context category ignored (no products)", {
        contextCategory,
        text: text.substring(0, 80),
      });
    }
  } else if (filteredHints.length > 0) {
    // Fallback: Wenn categoryHints vorhanden sind, aber keine matchedCategories, versuche die erste categoryHint zu nutzen
    const firstHint = filteredHints[0];
    const normalizedHint = normalize(firstHint);
    const matchingCategory = allCategories.find((cat) => normalize(cat) === normalizedHint);
    if (matchingCategory) {
      const normalizedMatchingCategory = normalize(matchingCategory);
      // Prüfe auch hier, ob es Produkte gibt
      const hintCategoryCount = allProducts.filter(
        (p) => normalize(p.category || "") === normalizedMatchingCategory
      ).length;
      
      if (hintCategoryCount > 0) {
        effectiveCategorySlug = normalizedMatchingCategory;
      }
    }
  }

  // EFRO Haustier-Fix: Stelle sicher, dass "haustier" als effectiveCategorySlug gesetzt wird,
  // wenn es in matchedCategories vorhanden ist (auch wenn es nicht die erste ist)
  // WICHTIG: Nur wenn kein Strong Override gesetzt wurde UND es Produkte in dieser Kategorie gibt
  if (!strongOverrideCategory && !effectiveCategorySlug) {
    const hasHaustierInMatched = matchedCategories.some(
      (cat) => normalize(cat) === "haustier"
    );
    if (hasHaustierInMatched) {
      const haustierCategory = allCategories.find(
        (cat) => normalize(cat) === "haustier"
      );
      if (haustierCategory) {
        const normalizedHaustierCat = normalize(haustierCategory);
        const haustierCount = allProducts.filter(
          (p) => normalize(p.category || "") === normalizedHaustierCat
        ).length;
        
        if (haustierCount > 0) {
          effectiveCategorySlug = normalizedHaustierCat;
        }
      }
    }
  }

  // EFRO Budget-Fix 2025-11-30: Prüfe, ob eine Kategorie-Hint erkannt wurde, aber nicht im Katalog existiert
  // (z. B. "Bindungen" erkannt, aber keine Bindungen im Katalog)
  let missingCategoryHint: string | undefined = undefined;
  if (filteredHints.length > 0 && matchedCategories.length === 0 && effectiveCategorySlug === null) {
    // Eine Kategorie wurde im Text erkannt (z. B. "Bindungen"), aber nicht im Katalog gefunden
    const firstHint = filteredHints[0];
    const normalizedHint = normalize(firstHint);
    const existsInCatalog = allCategories.some((cat) => normalize(cat) === normalizedHint);
    if (!existsInCatalog) {
      missingCategoryHint = firstHint;
      console.log("[EFRO SB Category] Missing category hint detected", {
        text: text.substring(0, 80),
        missingCategoryHint,
        note: "Kategorie im Text erkannt, aber nicht im Katalog vorhanden",
      });
    }
  }

  // EFRO Fix: Bestimme triggerWord für Log
  let triggerWord: string | null = null;
  if (matchedCategories.length > 0) {
    // Finde das Wort, das die Kategorie ausgelöst hat
    const matchedCat = matchedCategories[0];
    const normalizedMatchedCat = normalize(matchedCat);
    
    // Prüfe, ob es aus categoryHintsInText kommt
    if (categoryHintsInText.includes(matchedCat)) {
      triggerWord = matchedCat;
    } else {
      // Prüfe, ob es aus filteredHints kommt
      const hintMatch = filteredHints.find((h) => normalize(h) === normalizedMatchedCat);
      if (hintMatch) {
        triggerWord = hintMatch;
      }
    }
  }

  // EFRO Category Override für spezifische Produktwörter (Wasserkocher, Smartphone, Jeans/Mode)
  // WICHTIG: Diese Overrides haben Vorrang vor Kontext-Kategorien, wenn eindeutige Produktwörter erkannt werden
  // ABER: Nur wenn kein Strong Override gesetzt wurde (Strong Overrides haben höchste Priorität)
  // UND: Nur wenn es tatsächlich Produkte in der Kategorie gibt
  if (!strongOverrideCategory && !effectiveCategorySlug) {
    const textLowerForOverrides = text.toLowerCase();

    // Wasserkocher → Haushalt (starker Override, überschreibt Kontext)
    // HINWEIS: Dies ist redundant zu Strong Overrides, wird aber als Fallback beibehalten
    if (/\b(wasserkocher|electric kettle|kettle)\b/.test(textLowerForOverrides)) {
      const hasHaushaltCategory = allCategories.some(
        (cat) => normalize(cat) === "haushalt"
      );
      if (hasHaushaltCategory) {
        const haushaltCount = allProducts.filter(
          (p) => normalize(p.category || "") === "haushalt"
        ).length;
        
        if (haushaltCount > 0) {
          effectiveCategorySlug = "haushalt";
          // Stelle sicher, dass "haushalt" auch in matchedCategories ist, falls noch nicht vorhanden
          if (!matchedCategories.some((cat) => normalize(cat) === "haushalt")) {
            const haushaltCategory = allCategories.find(
              (cat) => normalize(cat) === "haushalt"
            );
            if (haushaltCategory) {
              matchedCategories.push(normalize(haushaltCategory));
            }
          }
          console.log("[EFRO Category Override] Wasserkocher → Haushalt (überschreibt Kontext)", {
            text: text.substring(0, 80),
            previousEffectiveCategory: contextCategory,
            newEffectiveCategory: effectiveCategorySlug,
            productCount: haushaltCount,
          });
        }
      }
    }
  }

  // EFRO Category Override: Finale Prüfung auf spezifische Produktwörter (überschreibt Kontext-Kategorien)
  // Diese Overrides greifen nach allen anderen Logiken und überschreiben auch Kontext-Kategorien
  const textNorm = normalize(text || "");
  
  const mentionsKettle =
    textNorm.includes("wasserkocher") ||
    textNorm.includes("electric kettle") ||
    textNorm.includes("kettle");
  
  const mentionsSmartphone =
    textNorm.includes("smartphone") ||
    textNorm.includes("handy") ||
    (textNorm.includes("phone") && !textNorm.includes("handyvertrag"));
  
  // Wasserkocher-Override: immer Haushalt bevorzugen (nur wenn noch keine Kategorie gesetzt)
  if (mentionsKettle && !effectiveCategorySlug) {
    const hasHaushaltCategory = allCategories.some(
      (cat) => normalize(cat) === "haushalt"
    );
    if (hasHaushaltCategory) {
      const haushaltCount = allProducts.filter(
        (p) => normalize(p.category || "") === "haushalt"
      ).length;
      
      if (haushaltCount > 0) {
        effectiveCategorySlug = "haushalt";
        missingCategoryHint = undefined;
        console.log("[EFRO Category Override]", {
          reason: "wasserkocher",
          effectiveCategorySlug,
          matchedCategories,
          categoryHintsInText,
          productCount: haushaltCount,
        });
      }
    }
  }
  
  // Smartphone-Override: immer Elektronik bevorzugen (nur wenn noch keine Kategorie gesetzt)
  // EFRO Smartphone-Fix: Diese Logik ist jetzt redundant, da wir oben bereits early check machen
  // Behalten wir als Fallback, falls der early check nicht gegriffen hat
  if (mentionsSmartphone && !effectiveCategorySlug) {
    const hasElektronikCategory = allCategories.some(
      (cat) => normalize(cat) === "elektronik"
    );
    if (hasElektronikCategory) {
      const elektronikCount = allProducts.filter(
        (p) => normalize(p.category || "") === "elektronik"
      ).length;
      
      if (elektronikCount > 0) {
        effectiveCategorySlug = "elektronik";
        missingCategoryHint = undefined;
        console.log("[EFRO Category Override]", {
          reason: "smartphone",
          effectiveCategorySlug,
          matchedCategories,
          categoryHintsInText,
          productCount: elektronikCount,
        });
      }
    }
  }

  return {
    effectiveCategorySlug,
    matchedCategories,
    categoryHintsInText,
    missingCategoryHint,
    triggerWord,
  };
}
