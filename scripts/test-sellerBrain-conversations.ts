/* scripts/test-sellerBrain-conversations.ts
   Hardcore conversation tests (catalog-agnostic).
   Run with:
     pnpm -s tsx scripts/test-sellerBrain-conversations.ts
   Switch product source via:
     EFRO_DEBUG_PRODUCTS_URL="http://127.0.0.1:3000/api/efro/products?shop=...&debug=1"
*/

import { runSellerBrain } from "../src/lib/sales/sellerBrain";
import type { SellerBrainContext } from "../src/lib/sales/sellerBrain";
import type { EfroProduct } from "../src/lib/products/mockCatalog";

type TurnExpect = {
  minReco?: number;         // minimum recommended products
  maxReco?: number;         // maximum recommended products
  mustIncludeNote?: string; // substring in sales.notes (if present)
  mustNotIncludeNote?: string;
};

type Conversation = {
  id: string;
  title: string;
  turns: Array<{ user: string; expect?: TurnExpect }>;
};

function norm(s: string): string {
  return (s || "").toLowerCase().trim();
}

function pickNotes(result: any): string[] {
  const notes = result?.sales?.notes;
  return Array.isArray(notes) ? notes.map(String) : [];
}

function pickRecommended(result: any): EfroProduct[] {
  const rec = result?.recommended;
  return Array.isArray(rec) ? rec : [];
}

async function loadProducts(): Promise<{ products: EfroProduct[]; source: string }> {
  const url =
    process.env.EFRO_DEBUG_PRODUCTS_URL ??
    "http://127.0.0.1:3000/api/efro/debug-products?shop=local-dev";

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Product fetch failed: HTTP ${res.status}`);

  const data: any = await res.json().catch(() => ({}));

  const products = Array.isArray(data?.products) ? data.products : [];
  const source =
    String(data?.productsSource ?? data?.source ?? data?.products_source ?? "unknown");

  if (!products.length) throw new Error("No products returned from API");
  return { products, source };
}

// very small mutation to generate noise variants (hardcore without being random-garbage)
function mutateQuery(q: string, seed: number): string {
  const variants = [
    q,
    q.replace(/\bbitte\b/gi, ""),
    q.replace(/\s+/g, " ").trim(),
    q + "!",
    q.replace(/ü/g, "ue").replace(/ö/g, "oe").replace(/ä/g, "ae"),
    q.replace(/sch/gi, "sh"), // typo-ish
  ];
  return variants[Math.abs(seed) % variants.length];
}

function assertTurn(id: string, turnIndex: number, result: any, expect?: TurnExpect) {
  const replyText = String(result?.replyText ?? "");
  const rec = pickRecommended(result);
  const notes = pickNotes(result);

  if (!replyText.trim()) {
    throw new Error(`[${id}] turn ${turnIndex}: empty replyText`);
  }

  if (expect?.minReco !== undefined && rec.length < expect.minReco) {
    throw new Error(`[${id}] turn ${turnIndex}: rec count ${rec.length} < min ${expect.minReco}`);
  }
  if (expect?.maxReco !== undefined && rec.length > expect.maxReco) {
    throw new Error(`[${id}] turn ${turnIndex}: rec count ${rec.length} > max ${expect.maxReco}`);
  }
  if (expect?.mustIncludeNote && !notes.join(" ").includes(expect.mustIncludeNote)) {
    throw new Error(`[${id}] turn ${turnIndex}: notes missing "${expect.mustIncludeNote}" got=${JSON.stringify(notes)}`);
  }
  if (expect?.mustNotIncludeNote && notes.join(" ").includes(expect.mustNotIncludeNote)) {
    throw new Error(`[${id}] turn ${turnIndex}: notes must NOT include "${expect.mustNotIncludeNote}" got=${JSON.stringify(notes)}`);
  }
}

async function runConversation(conv: Conversation, products: EfroProduct[], seed: number) {
  let ctx: SellerBrainContext | null | undefined = null;

  for (let i = 0; i < conv.turns.length; i++) {
    const raw = conv.turns[i].user;
    const user = mutateQuery(raw, seed + i);

    const out: any = await runSellerBrain(user, "quick_buy", products, "starter", undefined, ctx ?? undefined);

    assertTurn(conv.id, i + 1, out, conv.turns[i].expect);

    // nextContext propagation (if present)
    ctx = out?.nextContext ?? out?.sellerBrain?.nextContext ?? ctx ?? undefined;

    const rec = pickRecommended(out);
    const notes = pickNotes(out);
    console.log(`✓ ${conv.id} turn ${i + 1}: rec=${rec.length} notes=${notes.join(",") || "-"}`);
  }
}

async function main() {
  const seed = Number(process.env.EFRO_CONVO_SEED ?? "1");
  const target = Number(process.env.EFRO_CONVO_TARGET ?? "60");

  const { products, source } = await loadProducts();
  console.log("[EFRO CONVO] Loaded products", { count: products.length, source });

  const base: Conversation[] = [
    {
      id: "C1",
      title: "Budget → Produkt → Zubehör (Kontext bleibt)",
      turns: [
        { user: "Ich brauche ein Smartphone bis 400 Euro.", expect: { minReco: 1 } },
        { user: "Hast du auch eine Schutzhülle dazu?", expect: { minReco: 1 } },
        { user: "Und ein Kabel, aber günstig.", expect: { minReco: 1 } },
      ],
    },
    {
      id: "C2",
      title: "Mehrdeutig: Board (Profi-Handling statt NO_PRODUCTS_FOUND)",
      turns: [
        { user: "Ich brauche ein Board.", expect: { minReco: 0 } },
        { user: "Snowboard, nicht Skateboard.", expect: { minReco: 0 } },
      ],
    },
    {
      id: "C3",
      title: "Kosmetik Budget + Präferenz",
      turns: [
        { user: "Duschgel unter 10 Euro, empfindliche Haut.", expect: { minReco: 0 } },
        { user: "Okay, dann bis 20 Euro.", expect: { minReco: 0 } },
      ],
    },
    {
      id: "C4",
      title: "Versand/Retoure (Antwort darf nicht leer sein)",
      turns: [
        { user: "Wie lange dauert der Versand nach Deutschland?", expect: { minReco: 0 } },
        { user: "Und Rückgabe – wie läuft das?", expect: { minReco: 0 } },
      ],
    },
  ];

  // Build a hardcore list by repeating with different seeds
  const runs: Conversation[] = [];
  for (let i = 0; i < target; i++) {
    const c = base[i % base.length];
    runs.push({ ...c, id: `${c.id}r${i + 1}` });
  }

  let passed = 0;
  const fails: string[] = [];

  for (let i = 0; i < runs.length; i++) {
    const conv = runs[i];
    try {
      await runConversation(conv, products, seed + i);
      passed++;
    } catch (e: any) {
      const msg = e?.message || String(e);
      fails.push(`${conv.id}: ${msg}`);
      console.log(`✗ ${conv.id} FAIL: ${msg}`);
    }
  }

  console.log("\n[EFRO CONVO] DONE", { total: runs.length, passed, failed: fails.length });
  if (fails.length) {
    console.log("[EFRO CONVO] FAILURES:");
    for (const f of fails.slice(0, 50)) console.log(" - " + f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[EFRO CONVO] fatal", e);
  process.exit(1);
});
