// src/lib/catalog/efro-attribute-test-products.ts
//
// Hinweis: Diese Datei ist so geschrieben, dass sie auch von ts-node ohne Next.js-Alias (@/)
// direkt geladen werden kann (für AI-Batch-Skripte).

/**
 * Lokaler Typ für Test-Produkte (kompatibel mit EfroProduct, aber ohne externe Abhängigkeiten)
 */
type EFROTestProduct = {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  tags: string[];
  category: string;
  rating?: number;
  popularityScore?: number;
  source?: string;
};

/**
 * Test-Produktliste für die Attribut-Engine (buildAttributeIndex, attributeFilters)
 * 
 * Aktivierung über Umgebungsvariable:
 * NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO=1
 * 
 * Nur aktiv auf local-dev Shop-Domain.
 * 
 * Schimmel-bezogene Testprodukte (für SchimmelRanking-Logik):
 * - attr-demo-05: "Badreiniger Fresh Bathroom" - family: "cleaner", enthält "Schimmel" in Beschreibung
 * - attr-demo-11: "Feuchte Reinigungstücher Wipes Allround" - family: "wipes", kein Schimmel-Bezug
 * 
 * Erwartetes Verhalten bei "Schimmel"-Anfragen:
 * - Reiniger/Sprays mit Schimmel-Bezug sollen bevorzugt werden (+3 Bonus)
 * - Tücher/Wipes sollen nachrangig erscheinen (-1 Malus)
 */
export const efroAttributeTestProducts: EFROTestProduct[] = [
  {
    id: "attr-demo-01",
    title: "Duschgel Sensitive Care für trockene, empfindliche Haut für Herren",
    description:
      "Mildes Duschgel speziell für trockene und empfindliche Haut. Dermatologisch getestet, für Herren entwickelt. Ideal für die tägliche Anwendung im Bad und Badezimmer. Enthält pflegende Inhaltsstoffe für sensible Haut.",
    price: 9.5,
    imageUrl: "/images/mock/attribute-demo/shower-gel-sensitive.jpg",
    tags: ["duschgel", "sensitive", "trockene haut", "herren", "männer", "bad", "badezimmer"],
    category: "kosmetik",
    rating: 4.7,
    popularityScore: 88,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-02",
    title: "Kids Shampoo Sanft & Mild für Kinder mit empfindlicher Kopfhaut",
    description:
      "Extra mildes Shampoo für Kinder. Entwickelt für empfindliche Kopfhaut und trockene Haare. Hypoallergen, ohne Parfüm. Perfekt für die tägliche Haarwäsche im Bad.",
    price: 6.95,
    imageUrl: "/images/mock/attribute-demo/kids-shampoo.jpg",
    tags: ["shampoo", "kinder", "kids", "empfindlich", "sensible haut", "kopfhaut", "trockene haare", "bad"],
    category: "kosmetik",
    rating: 4.9,
    popularityScore: 92,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-03",
    title: "Unisex Hoodie Street Style für Damen und Herren",
    description:
      "Stylischer Hoodie im Street-Style-Design. Unisex-Modell, passt für Damen, Frauen, Herren und Männer. Aus nachhaltiger Baumwolle, perfekt für den Alltag.",
    price: 45.9,
    imageUrl: "/images/mock/attribute-demo/hoodie-unisex.jpg",
    tags: ["hoodie", "unisex", "damen", "frauen", "herren", "männer", "street style"],
    category: "fashion",
    rating: 4.6,
    popularityScore: 85,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-04",
    title: "Küchenreiniger Power Clean für die Küche",
    description:
      "Hochwirksamer Reiniger speziell für die Küche. Entfernt Fett, Kalk und hartnäckige Verschmutzungen. Ideal für Arbeitsflächen, Herd und Spüle. Mit natürlichen Reinigungsstoffen.",
    price: 4.95,
    imageUrl: "/images/mock/attribute-demo/kitchen-cleaner.jpg",
    tags: ["reiniger", "cleaner", "küche", "kitchen", "reinigungs", "cleaning"],
    category: "haushalt",
    rating: 4.5,
    popularityScore: 80,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-05",
    title: "Badreiniger Fresh Bathroom für Bad und Badezimmer",
    description:
      "Spezieller Reiniger für Bad und Badezimmer. Entfernt Kalk, Seifenreste und Schimmel. Mit frischem Duft. Ideal für Fliesen, Duschkabine und Waschbecken.",
    price: 5.5,
    imageUrl: "/images/mock/attribute-demo/bathroom-cleaner.jpg",
    tags: ["reiniger", "cleaner", "bad", "badezimmer", "bathroom", "bath"],
    category: "haushalt",
    rating: 4.4,
    popularityScore: 78,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-06",
    title: "Hundeshampoo Sensitive Dog für Hunde mit empfindlicher Haut",
    description:
      "Mildes Shampoo speziell für Hunde mit empfindlicher Haut. Dermatologisch getestet, pH-neutral. Ideal für Welpen und Hunde mit trockener oder sensibler Haut. Für Hunde entwickelt.",
    price: 12.9,
    imageUrl: "/images/mock/attribute-demo/dog-shampoo-sensitive.jpg",
    tags: ["hund", "hunde", "dog", "shampoo", "empfindlich", "sensitive", "trockene haut", "welpe", "puppy"],
    category: "pet",
    rating: 4.8,
    popularityScore: 90,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-07",
    title: "Katzen Shampoo Soft Cat für Katzen",
    description:
      "Sanftes Shampoo für Katzen. Entwickelt für sensible Katzenhaut. Hypoallergen, ohne aggressive Inhaltsstoffe. Ideal für Kitten und erwachsene Katzen mit empfindlicher Haut.",
    price: 11.5,
    imageUrl: "/images/mock/attribute-demo/cat-shampoo-soft.jpg",
    tags: ["katze", "katzen", "cat", "cats", "shampoo", "sensible", "kitten", "empfindlich"],
    category: "pet",
    rating: 4.7,
    popularityScore: 87,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-08",
    title: "Baby Lotion Soft Care für Babys mit empfindlicher Haut",
    description:
      "Zarte Lotion speziell für Babys entwickelt. Für empfindliche Babyhaut geeignet. Hypoallergen, ohne Parfüm. Ideal für die tägliche Pflege von Babies und Kleinkindern.",
    price: 8.9,
    imageUrl: "/images/mock/attribute-demo/baby-lotion.jpg",
    tags: ["baby", "babies", "lotion", "creme", "cream", "empfindlich", "sensitive", "pflege"],
    category: "kosmetik",
    rating: 4.9,
    popularityScore: 95,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-09",
    title: "Universal Tier Pflege-Spray für Haustiere",
    description:
      "Vielseitiges Pflege-Spray für Haustiere. Geeignet für Hunde, Katzen und andere Haustiere. Ideal für die tägliche Fellpflege. Mit natürlichen Inhaltsstoffen, für Tiere entwickelt.",
    price: 15.9,
    imageUrl: "/images/mock/attribute-demo/pet-spray-universal.jpg",
    tags: ["haustier", "haustiere", "pet", "pets", "spray", "tier", "tiere", "pflege"],
    category: "pet",
    rating: 4.6,
    popularityScore: 82,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-10",
    title: "Olivenöl Seife Classic Soap mit natürlichem Öl",
    description:
      "Hochwertige Seife mit Olivenöl. Für trockene und reife Haut geeignet. Natürliche Inhaltsstoffe, ideal für die tägliche Reinigung. Klassische Seife mit pflegenden Ölen.",
    price: 7.5,
    imageUrl: "/images/mock/attribute-demo/olive-oil-soap.jpg",
    tags: ["seife", "soap", "öl", "oil", "olivenöl", "trockene haut", "reife haut", "mature"],
    category: "kosmetik",
    rating: 4.5,
    popularityScore: 75,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-11",
    title: "Feuchte Reinigungstücher Wipes Allround",
    description:
      "Vielseitige Reinigungstücher für den Alltag. Ideal für Bad, Küche und unterwegs. Sanft und effektiv. Perfekt für schnelle Reinigung ohne Wasser.",
    price: 3.95,
    imageUrl: "/images/mock/attribute-demo/wipes-allround.jpg",
    tags: ["tücher", "tuecher", "tuch", "wipes", "reinigung", "allround"],
    category: "haushalt",
    rating: 4.3,
    popularityScore: 70,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-12",
    title: "Schlafzimmer Duft-Spray Relax Bedroom",
    description:
      "Entspannendes Duft-Spray speziell für das Schlafzimmer. Mit beruhigenden Aromen für erholsamen Schlaf. Ideal für Schlafzimmer und Wohnzimmer. Für alle, die Entspannung suchen.",
    price: 19.9,
    imageUrl: "/images/mock/attribute-demo/bedroom-spray.jpg",
    tags: ["spray", "schlafzimmer", "bedroom", "duft", "relax", "wohnzimmer", "living room"],
    category: "wohnen",
    rating: 4.7,
    popularityScore: 83,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-13",
    title: "Duschgel für fettige Haut und Mischhaut",
    description:
      "Reinigendes Duschgel speziell für fettige Haut und Mischhaut entwickelt. Reguliert die Talgproduktion, ideal für die tägliche Anwendung im Bad. Für Herren und Damen geeignet.",
    price: 8.5,
    imageUrl: "/images/mock/attribute-demo/shower-gel-oily.jpg",
    tags: ["duschgel", "fettige haut", "oily skin", "mischhaut", "combination skin", "herren", "damen", "bad"],
    category: "kosmetik",
    rating: 4.4,
    popularityScore: 77,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-14",
    title: "Anti-Aging Creme für reife Haut Mature Skin Care",
    description:
      "Intensive Pflegecreme für reife Haut. Mit Anti-Aging-Wirkstoffen entwickelt. Ideal für mature Haut und reife Haut. Für Damen und Frauen ab 40 Jahren. Mit pflegenden Ölen.",
    price: 35.0,
    imageUrl: "/images/mock/attribute-demo/anti-aging-cream.jpg",
    tags: ["creme", "cream", "reife haut", "mature skin", "anti-aging", "anti aging", "damen", "frauen", "öl"],
    category: "kosmetik",
    rating: 4.8,
    popularityScore: 91,
    source: "efro-attribute-demo",
  },

  {
    id: "attr-demo-15",
    title: "Wohnzimmer Duft-Spray Living Room Fresh",
    description:
      "Frisches Duft-Spray für das Wohnzimmer. Mit belebenden Aromen. Ideal für Living Room und Wohnzimmer. Für alle, die eine frische Atmosphäre mögen. Unisex-Produkt.",
    price: 16.9,
    imageUrl: "/images/mock/attribute-demo/living-room-spray.jpg",
    tags: ["spray", "wohnzimmer", "living room", "duft", "fresh", "unisex"],
    category: "wohnen",
    rating: 4.6,
    popularityScore: 81,
    source: "efro-attribute-demo",
  },
];

