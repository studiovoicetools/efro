// src/lib/products/mockCatalog.ts

// Basis-Typ fuer EFRO-Produkte (unabhaengig von Shopify)
export type EfroProduct = {
  id: string;
  title: string;
  description: string;
  price: number;            // in EUR
  imageUrl?: string;
  tags?: string[];
  category?: string;
  rating?: number;          // optional: 0â€“5
  popularityScore?: number; // optional: fuer â€Bestsellerâ€œ-Logik
};

// Shopper-Intent fuer die spaetere Empfehlungslogik
export type ShoppingIntent =
  | "bargain"    // moeglichst guenstig
  | "premium"    // Qualitaet / teuer OK
  | "gift"       // Geschenk
  | "quick_buy"  // schnelle Entscheidung
  | "explore"    // Inspiration
  | "bundle";    // Set / mehrere Produkte

// Mock-Katalog â€“ hier kannst du beliebig erweitern
export const mockCatalog: EfroProduct[] = [
  {
    id: "dog-bed-cozy-001",
    title: "Cozy Pup Dream Bed",
    description:
      "Super weiches Hundebett fuer kleine und mittlere Hunde â€“ waschbar und rutschfest.",
    price: 49.9,
    imageUrl: "/images/mock/dog-bed-1.jpg",
    tags: ["dog", "bed", "comfort", "gift"],
    category: "pet",
    rating: 4.8,
    popularityScore: 95,
  },
  {
    id: "dog-toy-robust-001",
    title: "Unbreakable Chew Toy",
    description:
      "Extrem robustes Kauspielzeug fuer Power-Chewer mit integriertem Quietsch-Sound.",
    price: 19.9,
    imageUrl: "/images/mock/dog-toy-1.jpg",
    tags: ["dog", "toy", "chew", "bestseller"],
    category: "pet",
    rating: 4.6,
    popularityScore: 88,
  },
  {
    id: "dog-bundle-starter-001",
    title: "Starter Bundle: Bed + Toy + Treats",
    description:
      "Perfektes Starter-Set fuer neue Hundebesitzer â€“ Bett, Spielzeug und Leckerlis im Bundle.",
    price: 89.9,
    imageUrl: "/images/mock/dog-bundle-1.jpg",
    tags: ["dog", "bundle", "gift", "premium"],
    category: "pet",
    rating: 4.9,
    popularityScore: 97,
  },
  {
    id: "cat-bed-luxury-001",
    title: "Luxury Cat Cave",
    description:
      "Geschlossene Katzenhoehle mit weichem Innenfutter und abnehmbarem Kissen.",
    price: 59.9,
    imageUrl: "/images/mock/cat-bed-1.jpg",
    tags: ["cat", "bed", "premium"],
    category: "pet",
    rating: 4.7,
    popularityScore: 90,
  },
  {
    id: "gift-card-001",
    title: "Gift Card 50 â‚¬",
    description:
      "Digitale Geschenkkarte im Wert von 50 â‚¬ â€“ perfekt, wenn du unsicher bist.",
    price: 50,
    imageUrl: "/images/mock/gift-card-50.jpg",
    tags: ["gift", "generic"],
    category: "gift",
    rating: 4.5,
    popularityScore: 70,
  },
];

// Kleine Helper-Funktionen â€“ spaeter fuer Logik nutzbar
export function findProductById(id: string): EfroProduct | undefined {
  return mockCatalog.find((p) => p.id === id);
}

export function getProductsByTag(tag: string): EfroProduct[] {
  return mockCatalog.filter((p) => Array.isArray(p.tags) && p.tags.includes(tag));
}

export function getTopPopularProducts(limit: number = 3): EfroProduct[] {
  return [...mockCatalog]
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
    .slice(0, limit);
}
