/**
 * scripts/test-hardcore-conv600.ts
 *
 * End-to-end Conversation Hardcore Test via /api/efro/suggest (inkl. FAQ + Products + Context).
 *
 * Run:
 *   pnpm -s tsx scripts/test-hardcore-conv600.ts | tee /tmp/conv600.log
 *
 * ENV:
 *   EFRO_BASE_URL=http://127.0.0.1:3000
 *   EFRO_SHOP=test-shop.myshopify.com
 *   EFRO_TARGET_TURNS=600
 *   EFRO_SEED=1
 *   EFRO_CONV_MIN_TURNS=2
 *   EFRO_CONV_MAX_TURNS=5
 *   EFRO_QUIET=1                 (nur FAIL + DONE)
 */

type EfroProduct = {
  id?: string | number;
  title?: string;
  description?: string;
  category?: string;
  price?: number;
  tags?: string[] | string;
};

type SuggestResponse = {
  shop?: string;
  intent?: string;
  replyText?: string;
  recommended?: EfroProduct[];
  productCount?: number;
  productsSource?: string;
  sellerBrain?: {
    nextContext?: any;
    aiTrigger?: any;
  };
};

const BASE_URL = (process.env.EFRO_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const SHOP = (process.env.EFRO_SHOP ?? "test-shop.myshopify.com").trim();
const TARGET_TURNS = Math.max(10, Number(process.env.EFRO_TARGET_TURNS ?? "600"));
const SEED = Number(process.env.EFRO_SEED ?? "1");
const MIN_TURNS = Math.max(1, Number(process.env.EFRO_CONV_MIN_TURNS ?? "2"));
const MAX_TURNS = Math.max(MIN_TURNS, Number(process.env.EFRO_CONV_MAX_TURNS ?? "5"));
const QUIET = process.env.EFRO_QUIET === "1";

function out(s: string) {
  process.stdout.write(s.endsWith("\n") ? s : s + "\n");
}
function err(s: string) {
  process.stderr.write(s.endsWith("\n") ? s : s + "\n");
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rnd() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function norm(s: string): string {
  return (s || "").toLowerCase().trim();
}

function toTags(t: any): string[] {
  if (!t) return [];
  if (Array.isArray(t)) return t.map(String).map(norm).filter(Boolean);
  if (typeof t === "string") return t.split(",").map((x) => norm(x)).filter(Boolean);
  return [];
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function pickKeywordFromProduct(p: EfroProduct, r: () => number): string {
  const title = String(p.title ?? "");
  const tags = toTags(p.tags);
  const words = title
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map(norm)
    .filter((w) => w.length >= 4 && !["the", "with", "und", "oder", "für", "eine", "einen"].includes(w));

  const pool = [...tags, ...words].filter(Boolean);
  if (pool.length === 0) return norm(title).split(/\s+/)[0] || "produkt";
  return pick(pool, r);
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}) from ${url}: ${text.slice(0, 200)}`);
  }
}

async function loadProductsForShop(): Promise<{ products: EfroProduct[]; source: string }> {
  const url = `${BASE_URL}/api/efro/products?shop=${encodeURIComponent(SHOP)}&debug=1`;
  const data = await fetchJson(url);
  const products = Array.isArray(data?.products) ? (data.products as EfroProduct[]) : [];
  const source = typeof data?.source === "string" ? data.source : "products";
  if (products.length === 0) throw new Error(`0 products from ${url}`);
  return { products, source };
}

type Turn = { user: string; hardExpectReco?: boolean; note?: string };

function buildConversations(products: EfroProduct[], targetTurns: number, seed: number): Array<{ id: string; turns: Turn[] }> {
  const r = mulberry32(seed);
  const cats = Array.from(new Set(products.map((p) => norm(String(p.category ?? ""))).filter(Boolean)));
  const catFallback = cats.length ? cats : ["sport", "elektronik", "haushalt", "kosmetik"];

  const faqTurns: string[] = [
    "Wie sind eure Lieferzeiten nach Deutschland?",
    "Wie läuft Rückgabe und Garantie bei euch?",
    "Kannst du kurz Versandkosten und Retoure erklären?",
    "Welche Zahlungsarten gibt es?",
  ];

  const convs: Array<{ id: string; turns: Turn[] }> = [];
  let usedTurns = 0;
  let convIndex = 1;

  while (usedTurns < targetTurns) {
    const tCount = Math.min(MAX_TURNS, Math.max(MIN_TURNS, 2 + Math.floor(r() * (MAX_TURNS - MIN_TURNS + 1))));
    const anchor = pick(products, r);
    const kw = pickKeywordFromProduct(anchor, r);
    const cat = pick(catFallback, r);

    const budgets = [15, 25, 30, 50, 80, 100, 150, 200, 300, 600, 900];
    const anchorPrice = Number(anchor?.price ?? 0);
    // Option A: Budget am Anchor ausrichten, damit T1 (anchor-keyword) wirklich matcht (±20%-Fenster)
    const budget = anchorPrice > 0
      ? Math.max(10, Math.round(anchorPrice))
      : budgets[Math.floor(r() * budgets.length)];
    const langSwitch = r() < 0.15;

    // Turn 1: Produkt-/Keyword-getrieben (soll IMMER matchen, weil Keyword aus echtem Produkt)
    const t1 = langSwitch
      ? `Do you have something like "${kw}"? Budget about ${budget} €.` 
      : `Ich suche etwas wie "${kw}". Budget ca. ${budget} €.`

    // Turn 2: Refinement + Kategorie/Constraints
    const t2 = langSwitch
      ? `Make it more ${r() < 0.5 ? "premium" : "cheap"} and in category ${cat}.`
      : `Eher ${r() < 0.5 ? "hochwertig" : "preiswert"} – am besten Kategorie ${cat}.`

    // Turn 3: Cross-sell / Alternative / Out of stock simulation
    const t3 = langSwitch
      ? `If it's sold out, suggest an alternative. Also any accessories?`
      : `Wenn ausverkauft: bitte Alternative. Gibt’s passendes Zubehör dazu?`

    // Turn 4: FAQ (soll über suggest-route auch ohne Produkte beantwortbar sein)
    const t4 = pick(faqTurns, r);

    // Turn 5: Kontext-Check (nur kurze Bestätigung)
    const t5 = langSwitch
      ? `Summarize your recommendation in 2 bullet points.`
      : `Fasse deine Empfehlung bitte in 2 Bulletpoints zusammen.`

    const turnsAll: Turn[] = [
      { user: t1, hardExpectReco: true, note: "anchor-keyword" },
      { user: t2, hardExpectReco: false, note: "refine" },
      { user: t3, hardExpectReco: false, note: "alt+crosssell" },
      { user: t4, hardExpectReco: false, note: "faq" },
      { user: t5, hardExpectReco: false, note: "summary" },
    ];

    const turns = turnsAll.slice(0, tCount);
    convs.push({ id: `C${convIndex}`, turns });
    convIndex++;
    usedTurns += turns.length;
  }

  // exakte Turn-Anzahl
  let total = convs.reduce((a, c) => a + c.turns.length, 0);
  while (total > targetTurns) {
    const last = convs[convs.length - 1];
    if (!last) break;
    if (last.turns.length > 1) {
      last.turns.pop();
      total--;
    } else {
      convs.pop();
      total--;
    }
  }

  return convs;
}

async function callSuggest(text: string, prev: { intent?: string; context?: any; previousRecommendedIds?: string[] }, shop: string): Promise<SuggestResponse> {
  const url = `${BASE_URL}/api/efro/suggest?shop=${encodeURIComponent(shop)}&text=${encodeURIComponent(text)}`;
  // Prefer POST for context carrying
  const body = {
    shop,
    text,
    previousIntent: prev.intent ?? null,
    previousContext: prev.context ?? null,
    previousRecommendedIds: prev.previousRecommendedIds ?? [],
  };
  return await fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

function getRecoIds(reco: EfroProduct[] | undefined): string[] {
  if (!Array.isArray(reco)) return [];
  return reco
    .map((p) => (p?.id != null ? String(p.id) : ""))
    .filter(Boolean)
    .slice(0, 10);
}

async function main() {
  // Voraussetzung: Next läuft
  out(`[Hardcore] base=${BASE_URL} shop=${SHOP} targetTurns=${TARGET_TURNS} seed=${SEED} turnsPerConv=${MIN_TURNS}-${MAX_TURNS}`);
  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null as any);
  if (!health || !("ok" in (health as any))) {
    out(`[Hardcore] Hinweis: /api/health nicht geprüft (ok). Wichtig: pnpm dev muss laufen.`);
  }

  const { products, source } = await loadProductsForShop();
  out(`[Hardcore] Loaded products: ${products.length} source=${source}`);
  const convs = buildConversations(products, TARGET_TURNS, SEED);

  const totals = convs.reduce((a, c) => a + c.turns.length, 0);
  out(`[Hardcore] Built conversations: ${convs.length} totalTurns=${totals}`);

  let fail = 0;
  let pass = 0;
  let idx = 0;

  for (const conv of convs) {
    let prevIntent: string | undefined = undefined;
    let prevContext: any = undefined;
    let prevRecoIds: string[] = [];

    for (let t = 0; t < conv.turns.length; t++) {
      idx++;
      const turn = conv.turns[t];
      const label = `${conv.id}.T${t + 1}`;

      let resp: SuggestResponse;
      try {
        resp = await callSuggest(turn.user, { intent: prevIntent, context: prevContext, previousRecommendedIds: prevRecoIds }, SHOP);
      } catch (e: any) {
        fail++;
        if (!QUIET) err(`✗ ${label} FETCH_FAIL: ${String(e?.message ?? e)}`);
        else err(`✗ ${label} FETCH_FAIL`);
        continue;
      }

      const reply = String(resp?.replyText ?? "");
      const reco = Array.isArray(resp?.recommended) ? resp.recommended : [];
      const nextCtx = resp?.sellerBrain?.nextContext ?? null;
      const intent: string = String(resp?.intent ?? prevIntent ?? "");

      // Hard check: Turn 1 hat echtes Keyword aus Katalog → muss mind. 1 reco liefern
      const mustReco = !!turn.hardExpectReco;
      const okReply = reply.trim().length >= 5;
      const okReco = !mustReco || reco.length >= 1;

      if (okReply && okReco) {
        pass++;
        if (!QUIET) out(`✓ ${label} reco=${reco.length} intent=${intent} note=${turn.note ?? ""}`);
      } else {
        fail++;
        err(`✗ ${label} reco=${reco.length} intent=${intent} note=${turn.note ?? ""}`);
        err(`  user="${turn.user.slice(0, 140)}"`);
        err(`  reply="${reply.slice(0, 180)}"`);
      }

      prevIntent = intent || prevIntent;
      prevContext = nextCtx || prevContext;
      prevRecoIds = getRecoIds(reco);
    }
  }

  out(`\nDONE: pass=${pass} fail=${fail} total=${pass + fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  err(`[Hardcore] FATAL: ${String((e as any)?.message ?? e)}`);
  process.exit(2);
});
