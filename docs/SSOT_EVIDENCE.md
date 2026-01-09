# SSOT Evidence (auto-generated)

Generated: 2026-01-09T22:41:41+03:00
Branch: chore/docs-reset-20260104
Commit: b3932a0


## GIT_STATUS

```
## chore/docs-reset-20260104...origin/chore/docs-reset-20260104
 M .gitignore
 M docs/EFRO_CONTROL_CENTER.md
 M docs/SSOT_EVIDENCE.md
?? docs/POST_RLS_PROOF_SSOT_2026-01-09.md

b3932a0 docs: add Gate-2 FINAL SSOT proof (2026-01-07) + link in control center
```

## API_ROUTES

```
src/app/api/eleven-offer/route.ts
src/app/api/convai/offer/route.ts
src/app/api/health/route.ts
src/app/api/verify/route.ts
src/app/api/get-signed-url-seller/route.ts
src/app/api/demo-products/route.ts
src/app/api/supabase-products/route.ts
src/app/api/cross-sell/route.ts
src/app/api/sellerbrain-ai/route.ts
src/app/api/shopify-import/route.ts
src/app/api/landing-chat/route.ts
src/app/api/shopify-webhook/route.ts
src/app/api/get-signed-url/route.ts
src/app/api/webhooks/app-uninstalled/route.ts
src/app/api/webhooks/gdpr/customer-redact/route.ts
src/app/api/shopify/callback/route.ts
src/app/api/efro/repository/cache/route.ts
src/app/api/efro/repository/products/route.ts
src/app/api/efro/repository/shop/route.ts
src/app/api/efro/shops/route.ts
src/app/api/efro/products/route.ts
src/app/api/efro/log-event/route.ts
src/app/api/efro/voice-preview/route.ts
src/app/api/efro/ai-unknown-terms/route.ts
src/app/api/efro/debug-shop-meta/route.ts
src/app/api/efro/events/route.ts
src/app/api/efro/onboard-shop/route.ts
src/app/api/efro/shop-meta/route.ts
src/app/api/efro/suggest/route.ts
src/app/api/efro/admin/update-plan/route.ts
src/app/api/efro/debug-products/route.ts
src/app/api/efro/shop-settings/route.ts
src/app/api/checkout/url/route.ts
src/app/api/supabase/sync-schema/route.ts
src/app/api/billing/route.ts
src/app/api/get-realtime-token/route.ts
src/app/api/explain-product/route.ts
src/app/api/subscriptions/route.ts
src/app/api/cart/add/route.ts
src/app/api/shopify-products/route.ts
```

## ENV_READS

```
scripts/_catReport.ts:23:  process.env.EFRO_DEBUG_PRODUCTS_URL ??
scripts/_generateCuratedLive612.ts:20:  process.env.EFRO_DEBUG_PRODUCTS_URL ??
scripts/gen-sellerbrain-conversations.ts:349:  const multiTurnRatio = Number(process.env.EFRO_CONVGEN_MULTITURN_RATIO ?? 0.55); // default: viele multi-turn
scripts/gen-sellerbrain-conversations.ts:350:  const noiseRatio = Number(process.env.EFRO_CONVGEN_NOISE_RATIO ?? 0.80); // default: viel noise
scripts/gen-sellerbrain-conversations.ts:351:  const strictEncoding = process.env.EFRO_CONVGEN_STRICT_ENCODING !== "0"; // default true
scripts/gen-sellerbrain-conversations.ts:472:  const source = (process.env.EFRO_CONVGEN_SOURCE ?? "").toLowerCase().trim();
scripts/gen-sellerbrain-conversations.ts:475:    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
scripts/gen-sellerbrain-conversations.ts:476:    const key = process.env.SUPABASE_SERVICE_KEY;
scripts/gen-sellerbrain-conversations.ts:485:    const take = Number(process.env.EFRO_PRODUCTS_TAKE ?? 100);
scripts/gen-sellerbrain-conversations.ts:486:    const limit = Math.max(take, Number(process.env.EFRO_PRODUCTS_LIMIT ?? 200));
scripts/gen-sellerbrain-conversations.ts:494:    const shopUuid = process.env.EFRO_SHOP_UUID;
scripts/gen-sellerbrain-conversations.ts:505:    process.env.EFRO_DEBUG_PRODUCTS_URL || "http://localhost:3000/api/efro/debug-products?shop=local-dev";
scripts/gen-sellerbrain-conversations.ts:506:  const fixturePath = process.env.EFRO_CONVGEN_FIXTURE_PATH || "scripts/fixtures/products.local.json";
scripts/gen-sellerbrain-conversations.ts:507:const allowFixtureFallback = (process.env.EFRO_CONVGEN_ALLOW_FIXTURE_FALLBACK ?? "1") !== "0";
scripts/gen-sellerbrain-conversations.ts:508:  const take = Number(process.env.EFRO_PRODUCTS_TAKE ?? 100);
scripts/gen-sellerbrain-conversations.ts:552:  const target = Number(process.env.CONV_GEN_TARGET ?? 1000);
scripts/gen-sellerbrain-conversations.ts:553:  const seed = Number(process.env.CONV_SEED ?? 1337);
scripts/generateAliasMapFromAI.ts:206:  const apiKey = process.env.OPENAI_API_KEY;
scripts/lib/loadDebugProducts.ts:27:    (process.env.EFRO_ALLOW_FIXTURE_FALLBACK === "1");
scripts/snapshot-supabase-products50.ts:11:  const take = Number(process.env.EFRO_PRODUCTS_TAKE ?? "50");
scripts/snapshot-supabase-products50.ts:12:  const timeoutMs = Number(process.env.EFRO_PRODUCTS_TIMEOUT_MS ?? "12000");
scripts/test-hardcore-conv600.ts:41:const BASE_URL = (process.env.EFRO_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
scripts/test-hardcore-conv600.ts:42:const SHOP = (process.env.EFRO_SHOP ?? "test-shop.myshopify.com").trim();
scripts/test-hardcore-conv600.ts:43:const TARGET_TURNS = Math.max(10, Number(process.env.EFRO_TARGET_TURNS ?? "600"));
scripts/test-hardcore-conv600.ts:44:const SEED = Number(process.env.EFRO_SEED ?? "1");
scripts/test-hardcore-conv600.ts:45:const MIN_TURNS = Math.max(1, Number(process.env.EFRO_CONV_MIN_TURNS ?? "2"));
scripts/test-hardcore-conv600.ts:46:const MAX_TURNS = Math.max(MIN_TURNS, Number(process.env.EFRO_CONV_MAX_TURNS ?? "5"));
scripts/test-hardcore-conv600.ts:47:const QUIET = process.env.EFRO_QUIET === "1";
scripts/test-loadProducts-scenarios.ts:3:const realShop = process.env.SHOPIFY_STORE_DOMAIN || "MISSING_SHOPIFY_STORE_DOMAIN";
scripts/test-sellerBrain-budget.ts:19:    process.env.EFRO_DEBUG_PRODUCTS_URL ??
scripts/test-sellerBrain-conversations.ts:115:  const seed = Number(process.env.EFRO_CONVO_SEED ?? "1");
scripts/test-sellerBrain-conversations.ts:116:  const target = Number(process.env.EFRO_CONVO_TARGET ?? "60");
scripts/test-sellerBrain-conversations.ts:42:    process.env.EFRO_DEBUG_PRODUCTS_URL ??
scripts/test-sellerBrain-scenarios-curated.ts:435:    const targetTotal = Number(process.env.EFRO_SCENARIO_TARGET ?? "0");
scripts/test-sellerBrain-scenarios-curated.ts:438:        `FAIL: EFRO_SCENARIO_TARGET is set (${process.env.EFRO_SCENARIO_TARGET}) — curated suite must not be run with a target to artificially fill scenarios.`
scripts/test-sellerBrain-scenarios-curated.ts:81:    process.env.EFRO_DEBUG_PRODUCTS_URL ??
scripts/test-sellerBrain-scenarios.ts:2731:    const envTargetTotal = Number(process.env.EFRO_SCENARIO_TARGET ?? "0");
scripts/test-sellerBrain-scenarios.ts:2733:const seed = Number(process.env.EFRO_SCENARIO_SEED ?? "1");
scripts/test-sellerBrain-scenarios.ts:49:    process.env.EFRO_DEBUG_PRODUCTS_URL ??
scripts/test-sellerBrain-scenarios.ts:53:  const allowFixtureFallback = process.env.EFRO_ALLOW_FIXTURE_FALLBACK === "1";
src/app/api/billing/route.ts:121:    let accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
src/app/api/billing/route.ts:138:      (process.env.NEXT_PUBLIC_APP_URL
src/app/api/billing/route.ts:139:        ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing`
src/app/api/billing/route.ts:157:        test: process.env.SHOPIFY_BILLING_TEST === "true",
src/app/api/billing/route.ts:208:      test: process.env.SHOPIFY_BILLING_TEST === "true",
src/app/api/billing/route.ts:66:      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
src/app/api/billing/route.ts:68:      process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
src/app/api/billing/route.ts:81:    if (process.env.BILLING_DISABLED === "true") {
src/app/api/cart/add/route.ts:16:    const domain = process.env.SHOPIFY_STORE_DOMAIN;
src/app/api/cart/add/route.ts:17:    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
src/app/api/convai/offer/route.ts:4:const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY!;
src/app/api/convai/offer/route.ts:5:const ELEVEN_AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;
src/app/api/efro/shop-settings/route.ts:18:  const url = process.env.SUPABASE_URL;
src/app/api/efro/shop-settings/route.ts:19:  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
src/app/api/efro/suggest/route.ts:67:const FAQ_THRESHOLD = Number(process.env.EFRO_FAQ_THRESHOLD ?? DEFAULT_FAQ_THRESHOLD);
src/app/api/efro/voice-preview/route.ts:68:    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
src/app/api/explain-product/route.ts:22:    if (!process.env.OPENAI_API_KEY) {
src/app/api/explain-product/route.ts:31:      process.env.NEXT_PUBLIC_BASE_URL ||
src/app/api/explain-product/route.ts:32:      `http://localhost:${process.env.PORT || 3000}`;
src/app/api/explain-product/route.ts:86:          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
src/app/api/get-realtime-token/route.ts:7:      { method: "GET", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } }
src/app/api/get-signed-url-seller/route.ts:133:    const mascotApiKey = process.env.MASCOT_BOT_API_KEY;
src/app/api/get-signed-url-seller/route.ts:134:    const elevenApiKey = process.env.ELEVENLABS_API_KEY;
src/app/api/get-signed-url-seller/route.ts:135:    const elevenAgentId = process.env.ELEVENLABS_AGENT_ID;
src/app/api/get-signed-url/route.ts:133:    const mascotApiKey = process.env.MASCOT_BOT_API_KEY;
src/app/api/get-signed-url/route.ts:134:    const elevenApiKey = process.env.ELEVENLABS_API_KEY;
src/app/api/get-signed-url/route.ts:135:    const elevenAgentId = process.env.ELEVENLABS_AGENT_ID;
src/app/api/sellerbrain-ai/route.ts:108:      apiKey: process.env.OPENAI_API_KEY,
src/app/api/sellerbrain-ai/route.ts:8:  if (process.env.OPENAI_API_KEY) {
src/app/api/sellerbrain-ai/route.ts:93:  if (!process.env.OPENAI_API_KEY || !OpenAI) {
src/app/api/shopify-import/route.ts:10:    const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
src/app/api/shopify-import/route.ts:27:    const store = process.env.SHOPIFY_STORE_DOMAIN;
src/app/api/shopify-import/route.ts:28:    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
src/app/api/shopify-import/route.ts:9:    const supabaseUrl = process.env.SUPABASE_URL;
src/app/api/shopify-products/route.ts:10:const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
src/app/api/shopify-products/route.ts:9:const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
src/app/api/shopify-webhook/route.ts:7:const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/app/api/shopify-webhook/route.ts:8:const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
src/app/api/subscriptions/route.ts:11:      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
src/app/api/subscriptions/route.ts:13:      process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
src/app/api/supabase-products/route.ts:7:    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/app/api/supabase-products/route.ts:8:    const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
src/app/api/webhooks/gdpr/customer-redact/route.ts:9:  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
src/app/avatar-seller/page.tsx:820:          process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
src/app/avatar-seller/page.tsx:845:        process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
src/app/efro/onboarding/page.tsx:79:    voiceId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_1 ?? "",
src/app/efro/onboarding/page.tsx:85:    voiceId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_2 ?? "",
src/app/efro/onboarding/page.tsx:91:    voiceId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_1 ?? "",
src/app/efro/onboarding/page.tsx:97:    voiceId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_2 ?? "",
src/efro_legacy/test-api/env-test/route.ts:3:    SUPABASE_URL: process.env.SUPABASE_URL,
src/efro_legacy/test-api/env-test/route.ts:4:    SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE_KEY ? "yes" : "NO!"
src/efro_legacy/test-api/query/route.ts:13:      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
src/efro_legacy/test-api/query/route.ts:15:      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
src/efro_legacy/test-api/voice-preview/route.ts:12:          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
src/lib/cleanupCache.ts:49:if (process.env.AUTO_CLEANUP === "true") {
src/lib/cleanupCache.ts:4:  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/lib/cleanupCache.ts:6:  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
src/lib/efro/efroSupabaseRepository.ts:18:    !!(process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)
src/lib/efro/logEventClient.ts:28:    if (process.env.NODE_ENV !== "production") {
src/lib/efro/supabaseServer.ts:12:  const url = process.env.SUPABASE_URL;
src/lib/efro/supabaseServer.ts:13:  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
src/lib/fetchAudioWithCache.ts:6:const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/lib/fetchAudioWithCache.ts:7:const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
src/lib/fetchWithCache.ts:3:const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/lib/fetchWithCache.ts:4:const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
src/lib/products/efroProductLoader.ts:101:  const envDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
src/lib/products/efroProductLoader.ts:117:    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
src/lib/products/efroProductLoader.ts:156:      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";
src/lib/products/efroProductLoader.ts:176:      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";
src/lib/products/efroProductLoader.ts:204:    const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
src/lib/products/efroProductLoader.ts:205:    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
src/lib/products/efroProductLoader.ts:213:        process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";
src/lib/products/efroProductLoader.ts:254:      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";
src/lib/products/efroProductLoader.ts:271:      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";
src/lib/products/efroProductLoader.ts:85:      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
src/lib/sales/aliasMap.ts:541:  const isDev = process.env.NODE_ENV !== "production";
src/lib/sales/allProductsForShop.ts:117:        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
src/lib/sales/allProductsForShop.ts:135:              process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
src/lib/sales/allProductsForShop.ts:170:      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
src/lib/sales/allProductsForShop.ts:64:    const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
src/lib/sales/allProductsForShop.ts:65:    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
src/lib/sales/allProductsForShop.ts:94:            process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
src/lib/shopify.ts:3:  process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "") || "";
src/lib/shopify.ts:5:  process.env.SHOPIFY_STOREFRONT_TOKEN ||
src/lib/shopify.ts:6:  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
src/lib/shops/onboardViaApi.ts:21:    process.env.INTERNAL_APP_URL ||
src/lib/shops/onboardViaApi.ts:22:    process.env.NEXT_PUBLIC_APP_URL ||
src/lib/supabase/admin.ts:10:  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
src/lib/supabase/admin.ts:9:    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
src/lib/supabaseClient.ts:3:const supabaseUrl = process.env.SUPABASE_URL as string
src/lib/supabaseClient.ts:4:const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string
src/lib/voices/voiceCatalog.ts:40:    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_1 ?? process.env.ELEVENLABS_AGENT_ID ?? "",
src/lib/voices/voiceCatalog.ts:46:    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_FEMALE_SOFT_2 ?? process.env.ELEVENLABS_AGENT_ID ?? "",
src/lib/voices/voiceCatalog.ts:52:    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_1 ?? process.env.ELEVENLABS_AGENT_ID ?? "",
src/lib/voices/voiceCatalog.ts:58:    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_DE_MALE_CONFIDENT_2 ?? process.env.ELEVENLABS_AGENT_ID ?? "",
src/lib/voices/voiceCatalog.ts:64:    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_EN_MALE_DEFAULT ?? process.env.ELEVENLABS_AGENT_ID ?? "",
src/lib/voices/voiceCatalog.ts:70:    agentId: process.env.NEXT_PUBLIC_EFRO_VOICE_EN_FEMALE_DEFAULT ?? process.env.ELEVENLABS_AGENT_ID ?? "",
src/utils/supabase/client.ts:3:const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/utils/supabase/client.ts:4:const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
src/utils/supabase/server.ts:4:const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/utils/supabase/server.ts:5:const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
```

## BRAIN_HINTS

```
src/lib/sales/README_LANGUAGE_RULES.md:112:- **Keine Breaking Changes**: `runSellerBrain` bleibt synchron
src/lib/sales/aliasMap.ts:390: * @param dynamicAliases Optional: Dynamische Aliase aus SellerBrainContext (vom AI-Resolver gelernt)
src/lib/sales/aliasMap.ts:513:  // 3. Dynamic Aliases aus SellerBrainContext hinzufügen (vom AI-Resolver gelernt)
src/lib/sales/salesTypes.ts:66: * Finales Ergebnis von runSellerBrain (inkl. Sales-Brain-Ausgabe)
src/lib/sales/salesTypes.ts:67: * Dies ist die Form, in der runSellerBrain am Ende antworten soll
src/lib/sales/salesTypes.ts:69:export interface SellerBrainFinalResult {
src/lib/sales/loadLanguageRulesFromSupabase.ts:7: * Da runSellerBrain synchron ist, werden die Supabase-Aufrufe hier gemacht
src/lib/sales/sellerBrain.ts:4:import type { SellerBrainContext, SellerBrainResult, PriceRangeInfo } from "@/lib/sales/modules/types";
src/lib/sales/sellerBrain.ts:5:import { runOrchestrator, runSellerBrainV2, productHints, staticProductHints } from "./brain/orchestrator";
src/lib/sales/sellerBrain.ts:7:export type { ProductHint, RunSellerBrainV2Options, SellerBrainV2Result } from "./brain/orchestrator";
src/lib/sales/sellerBrain.ts:8:export type { SellerBrainContext, SellerBrainResult, PriceRangeInfo };
src/lib/sales/sellerBrain.ts:10:export async function runSellerBrain(
src/lib/sales/sellerBrain.ts:16:  context?: SellerBrainContext
src/lib/sales/sellerBrain.ts:17:): Promise<SellerBrainResult> {
src/lib/sales/sellerBrain.ts:28:export { runOrchestrator, runSellerBrainV2, productHints, staticProductHints };
src/lib/sales/useSellerBrain.ts:1:// src/lib/sales/useSellerBrain.ts
src/lib/sales/useSellerBrain.ts:17:export type SellerBrainState = {
src/lib/sales/useSellerBrain.ts:32:export function useSellerBrain(initialIntent: ShoppingIntent = "quick_buy"): SellerBrainState {
src/lib/sales/modules/aiTrigger.ts:42: * AI-Trigger: Signal, wann SellerBrain zusätzliche AI-Hilfe gebrauchen könnte
src/lib/sales/modules/aiTrigger.ts:44:export interface SellerBrainAiTrigger {
src/lib/sales/modules/aiTrigger.ts:45:  /** true, wenn SellerBrain zusätzliche AI-Hilfe gebrauchen könnte */
src/lib/sales/modules/aiTrigger.ts:80: * @returns SellerBrainAiTrigger | undefined
src/lib/sales/modules/aiTrigger.ts:97:}): SellerBrainAiTrigger | undefined {
src/lib/sales/modules/aiTrigger.ts:143:      const trigger: SellerBrainAiTrigger = {
src/lib/sales/modules/aiTrigger.ts:166:    const trigger: SellerBrainAiTrigger = {
src/lib/sales/sellerBrainTypes.ts:1:// Zentrale Typen für SellerBrain
src/lib/sales/sellerBrainTypes.ts:7: * Kontext für SellerBrain (z. B. aktive Kategorie aus vorheriger Anfrage)
src/lib/sales/sellerBrainTypes.ts:9:export interface SellerBrainContext {
src/lib/sales/sellerBrainTypes.ts:16: * AI-Trigger: Signal, wann SellerBrain zusätzliche AI-Hilfe gebrauchen könnte
src/lib/sales/sellerBrainTypes.ts:18:export interface SellerBrainAiTrigger {
src/lib/sales/sellerBrainTypes.ts:19:  /** true, wenn SellerBrain zusätzliche AI-Hilfe gebrauchen könnte */
src/lib/sales/sellerBrainTypes.ts:47:export type SellerBrainResult = {
src/lib/sales/sellerBrainTypes.ts:51:  nextContext?: SellerBrainContext;
src/lib/sales/sellerBrainTypes.ts:53:  aiTrigger?: SellerBrainAiTrigger;
src/lib/sales/sellerBrainTypes.ts:82: * Optionen für runSellerBrainV2
src/lib/sales/sellerBrainTypes.ts:84:export interface RunSellerBrainV2Options {
src/lib/sales/sellerBrainTypes.ts:91: * Ergebnis von runSellerBrainV2 (erweitert SellerBrainResult um Cache-Flag)
src/lib/sales/sellerBrainTypes.ts:93:export interface SellerBrainV2Result extends SellerBrainResult {
src/lib/sales/modules/types/index.ts:26: * Kontext für SellerBrain (z. B. aktive Kategorie aus vorheriger Anfrage)
src/lib/sales/modules/types/index.ts:28:export interface SellerBrainContext {
src/lib/sales/modules/types/index.ts:35:   * Steuert den Antwortmodus von SellerBrain:
src/lib/sales/modules/types/index.ts:51:export type SellerBrainResult = {
src/lib/sales/modules/types/index.ts:55:  nextContext?: SellerBrainContext;
src/lib/sales/modules/ai/highBudget.ts:11: * → Dann soll SellerBrain OHNE AI auskommen.
src/lib/sales/modules/filter/index.ts:6:import type { PriceRangeInfo, SellerBrainContext } from "@/lib/sales/modules/types";
src/lib/sales/modules/filter/index.ts:1103:  // HINWEIS: Dynamic Aliases werden in runSellerBrain() verwendet (dort ist vollständiger SellerBrainContext verfügbar)
src/lib/sales/modules/filter/index.ts:2232:export async function filterProductsForSellerBrain(
src/lib/sales/modules/filter/index.ts:2246:// Alias: in dieser Funktion ist "cleaned" einfach der Text aus runSellerBrain
src/lib/sales/brain/types.ts:2:import type { SellerBrainContext, SellerBrainResult } from "@/lib/sales/modules/types";
src/lib/sales/brain/types.ts:12:  context?: SellerBrainContext;
src/lib/sales/brain/types.ts:15:export type BrainOutput = SellerBrainResult;
src/lib/sales/brain/steps/08_reply.ts:1:// src/lib/sales/brain/steps/08_reply.ts
src/lib/sales/brain/steps/08_reply.ts:5:import type { SellerBrainAiTrigger } from "../../modules/aiTrigger";
src/lib/sales/brain/steps/08_reply.ts:509:  aiTrigger?: SellerBrainAiTrigger,
src/lib/sales/brain/steps/08_reply.ts:554:  aiTrigger?: SellerBrainAiTrigger,
src/lib/sales/brain/orchestrator.ts:1:// src/lib/sales/brain/orchestrator.ts
src/lib/sales/brain/orchestrator.ts:4: * EFRO SellerBrain Übersicht (nur Doku):
src/lib/sales/brain/orchestrator.ts:6: * - Hauptfunktion: runSellerBrain(userText, currentIntent, allProducts, plan?, previousRecommended?, context?)
src/lib/sales/brain/orchestrator.ts:7: *   → Gibt SellerBrainResult zurück
src/lib/sales/brain/orchestrator.ts:9: * - Rückgabe-Typ: SellerBrainResult (definiert in src/lib/sales/modules/types/index.ts)
src/lib/sales/brain/orchestrator.ts:14: *     • nextContext?: SellerBrainContext (z.B. activeCategorySlug)
src/lib/sales/brain/orchestrator.ts:22: * - Filter-Modul: filterProductsForSellerBrain(text, intent, allProducts, contextCategory?)
src/lib/sales/brain/orchestrator.ts:24: *   → Wird intern von runSellerBrain aufgerufen
src/lib/sales/brain/orchestrator.ts:33: * 1. Defensive Guard f?r leere allProducts in runSellerBrain() hinzugef?gt
src/lib/sales/brain/orchestrator.ts:36: * 2. Defensive Guard f?r leeren/undefined replyText am Ende von runSellerBrain()
src/lib/sales/brain/orchestrator.ts:60: *    ? runSellerBrain() und SellerBrainResult bleiben unver?ndert
src/lib/sales/brain/orchestrator.ts:183:  SellerBrainAiTrigger,
src/lib/sales/brain/orchestrator.ts:189:import { filterProductsForSellerBrain } from "../modules/filter";
src/lib/sales/brain/orchestrator.ts:202:  SellerBrainContext,
src/lib/sales/brain/orchestrator.ts:203:  SellerBrainResult,
src/lib/sales/brain/orchestrator.ts:211:// Import f?r SellerBrain v2 (Repository & Cache)
src/lib/sales/brain/orchestrator.ts:279:  SellerBrainContext,
src/lib/sales/brain/orchestrator.ts:280:  SellerBrainResult,
src/lib/sales/brain/orchestrator.ts:652:  aiTrigger?: SellerBrainAiTrigger;
src/lib/sales/brain/orchestrator.ts:738:  console.log("[EFRO SellerBrain] Explanation mode ? Direkt aus Beschreibung", {
src/lib/sales/brain/orchestrator.ts:747:  const aiTrigger: SellerBrainAiTrigger | undefined = undefined;
src/lib/sales/brain/orchestrator.ts:2108:  // HINWEIS: Dynamic Aliases werden in runSellerBrain() verwendet (dort ist vollständiger SellerBrainContext verfügbar)
src/lib/sales/brain/orchestrator.ts:3165:  return await filterProductsForSellerBrain(
src/lib/sales/brain/orchestrator.ts:3488:  logInfo("[EFRO SB] ENTER runSellerBrain", {
src/lib/sales/brain/orchestrator.ts:3525:  logInfo("[EFRO SellerBrain] explanationMode", {
src/lib/sales/brain/orchestrator.ts:3643:    let aiTrigger: SellerBrainAiTrigger | undefined = undefined;
src/lib/sales/brain/orchestrator.ts:3686:      "[EFRO SellerBrain] Explanation mode ? Direkt aus Beschreibung",
src/lib/sales/brain/orchestrator.ts:4007:       console.log("[EFRO SellerBrain] Off-topic detected, no new filtering", {
src/lib/sales/brain/orchestrator.ts:4646:    console.log("[EFRO SellerBrain FORCE_PRODUCTS]", {
src/lib/sales/brain/orchestrator.ts:5386:  let aiTrigger: SellerBrainAiTrigger | undefined = undefined;
src/lib/sales/brain/orchestrator.ts:6231:  const nextContext: SellerBrainContext | undefined = effectiveCategorySlug
src/lib/sales/brain/orchestrator.ts:6320:        "[EFRO SB] Missing category hint detected in runSellerBrain",
src/lib/sales/brain/orchestrator.ts:6854:export async function runSellerBrain(
src/lib/sales/brain/orchestrator.ts:6860:  context?: SellerBrainContext,
src/lib/sales/brain/orchestrator.ts:6861:): Promise<SellerBrainResult> {
src/lib/sales/brain/orchestrator.ts:6888: * Optionen f?r runSellerBrainV2
src/lib/sales/brain/orchestrator.ts:6890:export interface RunSellerBrainV2Options {
src/lib/sales/brain/orchestrator.ts:6895:   * Steuert den Antwortmodus von SellerBrain:
src/lib/sales/brain/orchestrator.ts:6904: * Ergebnis von runSellerBrainV2 (erweitert SellerBrainResult um Cache-Flag)
src/lib/sales/brain/orchestrator.ts:6906:export interface SellerBrainV2Result extends SellerBrainResult {
src/lib/sales/brain/orchestrator.ts:6929: * Baut ein SellerBrainResult aus einem gecachten Response.
src/lib/sales/brain/orchestrator.ts:6935:): SellerBrainResult {
src/lib/sales/brain/orchestrator.ts:6983: * K?rzt SellerBrain-ReplyTexte f?r das UI:
src/lib/sales/brain/orchestrator.ts:6990: * SellerBrain v2: Wrapper mit Supabase-Repository & Antwort-Cache.
src/lib/sales/brain/orchestrator.ts:6994: * - Ruft intern runSellerBrain (v1) als Engine auf
src/lib/sales/brain/orchestrator.ts:7000: * @param sellerContext - SellerBrain-Kontext (optional)
src/lib/sales/brain/orchestrator.ts:7002: * @returns SellerBrainV2Result mit fromCache-Flag
src/lib/sales/brain/orchestrator.ts:7004:export async function runSellerBrainV2(
src/lib/sales/brain/orchestrator.ts:7007:  sellerContext: SellerBrainContext | undefined,
src/lib/sales/brain/orchestrator.ts:7008:  options: RunSellerBrainV2Options,
src/lib/sales/brain/orchestrator.ts:7009:): Promise<SellerBrainV2Result> {
src/lib/sales/brain/orchestrator.ts:7013:  const effectiveContext: SellerBrainContext | undefined = sellerContext
src/lib/sales/brain/orchestrator.ts:7036:    const result = await runSellerBrain(
src/lib/sales/brain/orchestrator.ts:7115:      const uiResult: SellerBrainV2Result = {
src/lib/sales/brain/orchestrator.ts:7137:  // 5) SellerBrain v1 aufrufen
src/lib/sales/brain/orchestrator.ts:7139:  const sbResult = await runSellerBrain(
src/lib/sales/brain/orchestrator.ts:7194:  const uiResult: SellerBrainV2Result = {
src/lib/sales/brain/orchestrator.ts:7212: * DOKUMENTATION: SellerBrain v2
src/lib/sales/brain/orchestrator.ts:7215: * runSellerBrainV2 ist ein Wrapper um runSellerBrain (v1), der:
src/lib/sales/brain/orchestrator.ts:7218: * - Intern weiterhin runSellerBrain (v1) als Engine verwendet
src/lib/sales/brain/orchestrator.ts:7221: * - runSellerBrain (v1) bleibt unver?ndert und ist die eigentliche Engine
src/lib/sales/brain/orchestrator.ts:7233: * const result = await runSellerBrainV2(
```

## SUPABASE_HINTS

```
src/lib/supabaseClient.ts:1:import { createClient } from '@supabase/supabase-js'
src/lib/supabaseClient.ts:3:const supabaseUrl = process.env.SUPABASE_URL as string
src/lib/supabaseClient.ts:4:const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string
src/lib/supabaseClient.ts:6:if (!supabaseUrl || !supabaseAnonKey) {
src/lib/supabaseClient.ts:10:export const supabase = createClient(supabaseUrl, supabaseAnonKey)
src/lib/text/encoding.ts:34:      const repaired = Buffer.from(s, "latin1").toString("utf8");
src/lib/text/utf8.ts:42:          out = B.from(out, "latin1").toString("utf8");
src/lib/cleanupCache.ts:1:import { createClient } from "@supabase/supabase-js";
src/lib/cleanupCache.ts:3:const supabaseUrl =
src/lib/cleanupCache.ts:5:const supabaseKey =
src/lib/cleanupCache.ts:7:const supabase = createClient(supabaseUrl, supabaseKey);
src/lib/cleanupCache.ts:18:  const { data, error } = await supabase
src/lib/cleanupCache.ts:19:    .from("cache_audio")
src/lib/cleanupCache.ts:38:      await supabase.storage.from("public").remove([path]);
src/lib/cleanupCache.ts:39:      await supabase.from("cache_audio").delete().eq("id", row.id);
src/lib/products/shopifyMapper.ts:106:    const supabase = getSupabaseClient();
src/lib/products/shopifyMapper.ts:109:    const { data, error } = await supabase
src/lib/products/shopifyMapper.ts:110:      .from("products")
src/lib/products/enrichProducts.ts:111:    const uniqueTags = Array.from(new Set(tags));
src/lib/supabase/admin.ts:1:import { createClient, SupabaseClient } from "@supabase/supabase-js";
src/lib/supabase/admin.ts:20:  adminClient = createClient(url, serviceRoleKey, {
src/lib/fetchAudioWithCache.ts:1:import { createClient } from "@supabase/supabase-js";
src/lib/fetchAudioWithCache.ts:6:const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/lib/fetchAudioWithCache.ts:7:const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
src/lib/fetchAudioWithCache.ts:8:const supabase = createClient(supabaseUrl, supabaseKey);
src/lib/fetchAudioWithCache.ts:23:  const { data } = await supabase
src/lib/fetchAudioWithCache.ts:24:    .from("cache_audio")
src/lib/fetchAudioWithCache.ts:44:  const { data: upload, error: uploadErr } = await supabase.storage
src/lib/fetchAudioWithCache.ts:45:    .from("public")
src/lib/fetchAudioWithCache.ts:53:  const audioUrl = `${supabaseUrl}/storage/v1/object/public/${upload.path}`;
src/lib/fetchAudioWithCache.ts:56:  await supabase.from("cache_audio").upsert({
src/lib/fetchShopifyProducts.ts:29:    const res = await fetch(`/api/supabase-products?${params.toString()}`);
src/lib/fetchWithCache.ts:1:import { createClient } from "@supabase/supabase-js";
src/lib/fetchWithCache.ts:3:const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
src/lib/fetchWithCache.ts:4:const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
src/lib/fetchWithCache.ts:5:const supabase = createClient(supabaseUrl, supabaseKey);
src/lib/fetchWithCache.ts:13:  const { data } = await supabase
src/lib/fetchWithCache.ts:14:    .from("cache_responses")
src/lib/fetchWithCache.ts:29:  await supabase.from("cache_responses").upsert({
src/lib/fetchSupabaseProducts.ts:20:  const url = `/api/supabase-products?q=${encodeURIComponent(q || "")}&limit=${limit}`;
src/lib/efro/logEventServer.ts:3:import { getEfroSupabaseServerClient } from "./supabaseServer";
src/lib/efro/logEventServer.ts:24:  const supabase = getEfroSupabaseServerClient();
src/lib/efro/logEventServer.ts:26:  if (!supabase) {
src/lib/efro/logEventServer.ts:32:    const { data, error } = await supabase
src/lib/efro/logEventServer.ts:33:      .from("efro_events")
src/lib/efro/supabaseServer.ts:1:// src/lib/efro/supabaseServer.ts
src/lib/efro/supabaseServer.ts:3:import { createClient, SupabaseClient } from "@supabase/supabase-js";
src/lib/efro/supabaseServer.ts:19:  return createClient(url, key, {
src/lib/efro/efroSupabaseRepository.ts:9:import { getEfroSupabaseServerClient } from "./supabaseServer";
src/lib/efro/efroSupabaseRepository.ts:102:    const supabase = getEfroSupabaseServerClient();
src/lib/efro/efroSupabaseRepository.ts:103:    if (!supabase) {
src/lib/efro/efroSupabaseRepository.ts:110:    const { data, error } = await supabase
src/lib/efro/efroSupabaseRepository.ts:111:      .from("efro_shops")
src/lib/efro/efroSupabaseRepository.ts:183:    const supabase = getEfroSupabaseServerClient();
src/lib/efro/efroSupabaseRepository.ts:184:    if (!supabase) {
src/lib/efro/efroSupabaseRepository.ts:190:    const { data, error } = await supabase
src/lib/efro/efroSupabaseRepository.ts:191:      .from("efro_shops")
src/lib/efro/efroSupabaseRepository.ts:220:      const { data: fallbackData, error: fallbackError } = await supabase
src/lib/efro/efroSupabaseRepository.ts:221:        .from("efro_shops")
src/lib/efro/efroSupabaseRepository.ts:303:    const supabase = getEfroSupabaseServerClient();
src/lib/efro/efroSupabaseRepository.ts:304:    if (!supabase) {
src/lib/efro/efroSupabaseRepository.ts:316:      const { data, error } = await supabase
src/lib/efro/efroSupabaseRepository.ts:317:        .from("products")
src/lib/efro/efroSupabaseRepository.ts:332:        const { data: dataWithoutFilter, error: errorWithoutFilter } = await supabase
src/lib/efro/efroSupabaseRepository.ts:333:          .from("products")
src/lib/efro/efroSupabaseRepository.ts:349:      const { data, error } = await supabase
src/lib/efro/efroSupabaseRepository.ts:350:        .from("products")
src/lib/efro/efroSupabaseRepository.ts:383:    const { data: demoData, error: demoError } = await supabase
src/lib/efro/efroSupabaseRepository.ts:384:      .from("products_demo")
src/lib/efro/efroSupabaseRepository.ts:544:    const supabase = getEfroSupabaseServerClient();
src/lib/efro/efroSupabaseRepository.ts:545:    if (!supabase) {
src/lib/efro/efroSupabaseRepository.ts:552:    const { data, error } = await supabase
src/lib/efro/efroSupabaseRepository.ts:553:      .from("cache_responses")
src/lib/efro/efroSupabaseRepository.ts:577:    await supabase
src/lib/efro/efroSupabaseRepository.ts:578:      .from("cache_responses")
src/lib/efro/efroSupabaseRepository.ts:641:    const supabase = getEfroSupabaseServerClient();
src/lib/efro/efroSupabaseRepository.ts:642:    if (!supabase) {
src/lib/efro/efroSupabaseRepository.ts:650:    const { data: existing } = await supabase
src/lib/efro/efroSupabaseRepository.ts:651:      .from("cache_responses")
src/lib/efro/efroSupabaseRepository.ts:663:    const { error } = await supabase.from("cache_responses").upsert(
src/lib/shops/db.ts:4:import { createClient } from "@/utils/supabase/server";
src/lib/shops/db.ts:28:    const supabase = createClient(cookieStore);
src/lib/shops/db.ts:30:    const { data, error } = await supabase
src/lib/shops/db.ts:31:      .from("efro_shops")
src/lib/shops/db.ts:74:    const supabase = createClient(cookieStore);
src/lib/shops/db.ts:76:    const { error } = await supabase
src/lib/shops/db.ts:77:      .from("efro_shops")
src/lib/sales/aliasMap.ts:104:    const { getEfroSupabaseServerClient } = await import("@/lib/efro/supabaseServer");
src/lib/sales/aliasMap.ts:105:    const supabase = getEfroSupabaseServerClient();
src/lib/sales/aliasMap.ts:107:    if (!supabase) {
src/lib/sales/aliasMap.ts:113:    let query = supabase.from("aliases_de").select("*");
src/lib/sales/aliasMap.ts:339:      map[key] = Array.from(new Set([...existing, ...filtered]));
src/lib/sales/aliasMap.ts:405:    const supabaseEntries = await loadAliasEntriesFromSupabase("de", shopDomain);
src/lib/sales/aliasMap.ts:406:    if (Array.isArray(supabaseEntries) && supabaseEntries.length > 0) {
src/lib/sales/aliasMap.ts:407:      console.log("[EFRO AliasMap] Supabase-Aliase geladen:", supabaseEntries.length);
src/lib/sales/aliasMap.ts:408:      allEntries = [...allEntries, ...supabaseEntries];
src/lib/sales/aliasMap.ts:450:    const values = Array.from(
src/lib/sales/aliasMap.ts:484:    map[key] = Array.from(new Set([...existing, ...values]));
src/lib/sales/aliasMap.ts:498:    const normalizedValues = Array.from(
src/lib/sales/aliasMap.ts:508:      const merged = Array.from(new Set([...existing, ...normalizedValues]));
src/lib/sales/aliasMap.ts:529:          map[key] = Array.from(new Set([...existing, normalizedValue]));
src/lib/sales/aliasMap.ts:554:      exampleKnown: Array.from(known)
src/lib/sales/loadLanguageRulesFromSupabase.ts:11:import { supabase } from "../supabaseClient";
src/lib/sales/loadLanguageRulesFromSupabase.ts:20:    const { data, error } = await supabase
src/lib/sales/loadLanguageRulesFromSupabase.ts:21:      .from("language_rules")
src/lib/sales/catalogKeywordAnalyzer.ts:166:  const keywords = Array.from(keywordMap.values()).sort(
src/lib/sales/aliasLearning.ts:131:    const { getEfroSupabaseServerClient } = await import("@/lib/efro/supabaseServer");
src/lib/sales/aliasLearning.ts:132:    const supabase = getEfroSupabaseServerClient();
src/lib/sales/aliasLearning.ts:134:    if (!supabase) {
src/lib/sales/aliasLearning.ts:141:    let query = supabase
src/lib/sales/aliasLearning.ts:142:      .from("aliases_de")
src/lib/sales/aliasLearning.ts:173:    const { error } = await supabase
src/lib/sales/aliasLearning.ts:174:      .from("aliases_de")
src/lib/sales/dynamicLanguageRules.ts:24:import { supabase } from "../supabaseClient";
src/lib/sales/dynamicLanguageRules.ts:44:    const { data, error } = await supabase
src/lib/sales/dynamicLanguageRules.ts:45:      .from("language_rules")
src/lib/sales/dynamicLanguageRules.ts:111:      const { error } = await supabase
src/lib/sales/dynamicLanguageRules.ts:112:        .from("language_rules")
src/lib/sales/dynamicLanguageRules.ts:127:      const { error } = await supabase
src/lib/sales/dynamicLanguageRules.ts:128:        .from("language_rules")
src/lib/sales/keywordHintGenerator.ts:151:  const hints = Array.from(hintMap.values());
src/lib/sales/languageRules.de.ts:845:      existing.extraKeywords = Array.from(merged);
src/lib/sales/languageRules.de.ts:846:      existing.keywords = Array.from(merged);
src/lib/sales/languageRules.de.ts:855:      existing.categoryHints = Array.from(merged);
src/lib/sales/modules/category/index.ts:223:  const allCategories = Array.from(
src/lib/sales/modules/utils/textUtils.ts:17:      const out = B.from(s, "latin1").toString("utf8");
src/lib/sales/modules/utils/textUtils.ts:25:      const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
src/lib/sales/modules/utils/textUtils.ts:129:  return Array.from(new Set(hits));
src/lib/sales/kb/kbStore.ts:32: * Später: supabase upsert nach shop_kb_facts.
src/lib/sales/modules/filter/index.ts:386:  const vocabulary: ShopAttributeVocabulary[] = Array.from(
src/lib/sales/modules/filter/index.ts:390:    values: Array.from(data.values).sort(),
src/lib/sales/modules/filter/index.ts:623:  const expanded = Array.from(result);
src/lib/sales/modules/filter/index.ts:721:      const fuzzyMatches = getClosestCatalogTokens(unknown, Array.from(knownSet));
src/lib/sales/modules/filter/index.ts:749:  const uniqUnknown = Array.from(unknownTermsSet);
src/lib/sales/modules/filter/index.ts:750:  const uniqResolved = Array.from(resolvedSet);
src/lib/sales/modules/filter/index.ts:758:    aliasResolved: Array.from(aliasResolvedSet),
src/lib/sales/modules/filter/index.ts:759:    fuzzyResolved: Array.from(fuzzyResolvedSet),
src/lib/sales/modules/filter/index.ts:760:    substringResolved: Array.from(substringResolvedSet),
src/lib/sales/modules/filter/index.ts:929:  const allCategories = Array.from(
src/lib/sales/modules/filter/index.ts:1100:  const catalogKeywords = Array.from(catalogKeywordsSet);
src/lib/sales/modules/filter/index.ts:1392:      words = Array.from(effectiveWordsSet);
src/lib/sales/modules/filter/index.ts:1393:      expandedWords = Array.from(effectiveWordsSet);
src/lib/sales/modules/filter/index.ts:1396:      const updatedWords = Array.from(
src/lib/sales/modules/filter/index.ts:1403:      const updatedExpandedWords = Array.from(
src/lib/sales/modules/filter/index.ts:2930:        aliasTerms: Array.from(aliasTerms),
src/lib/sales/brain/orchestrator.ts:415:  const merged = Array.from(mergedMap.values());
src/lib/sales/brain/orchestrator.ts:1344:  const vocabulary: ShopAttributeVocabulary[] = Array.from(
src/lib/sales/brain/orchestrator.ts:1348:    values: Array.from(data.values).sort(),
src/lib/sales/brain/orchestrator.ts:1621:  const expanded = Array.from(result);
src/lib/sales/brain/orchestrator.ts:1766:        Array.from(knownSet),
src/lib/sales/brain/orchestrator.ts:1805:  const uniqUnknown = Array.from(unknownTermsSet);
src/lib/sales/brain/orchestrator.ts:1806:  const uniqResolved = Array.from(resolvedSet);
src/lib/sales/brain/orchestrator.ts:1814:    aliasResolved: Array.from(aliasResolvedSet),
src/lib/sales/brain/orchestrator.ts:1815:    fuzzyResolved: Array.from(fuzzyResolvedSet),
src/lib/sales/brain/orchestrator.ts:1816:    substringResolved: Array.from(substringResolvedSet),
src/lib/sales/brain/orchestrator.ts:1965:  const allCategories = Array.from(
src/lib/sales/brain/orchestrator.ts:2105:  const catalogKeywords = Array.from(catalogKeywordsSet);
src/lib/sales/brain/orchestrator.ts:2407:      words = Array.from(effectiveWordsSet);
src/lib/sales/brain/orchestrator.ts:2408:      expandedWords = Array.from(effectiveWordsSet);
src/lib/sales/brain/orchestrator.ts:2411:      const updatedWords = Array.from(new Set([...words, ...resolvedSet]));
src/lib/sales/brain/orchestrator.ts:2413:      const updatedExpandedWords = Array.from(
src/lib/sales/brain/orchestrator.ts:2594:    const slugs = Array.from(
src/lib/sales/brain/orchestrator.ts:2606:      const dp = Array.from({ length: al + 1 }, () =>
src/lib/sales/brain/orchestrator.ts:3895:const knownCategories = Array.from(
src/lib/sales/brain/orchestrator.ts:4825:    Array.from(catalogKeywordsSetForAlias),
src/lib/sales/brain/orchestrator.ts:4831:    Array.from(catalogKeywordsSetForAlias),
src/lib/sales/brain/orchestrator.ts:4974:  const unknownTermsFromAnalysis = Array.from(unknownTermsSet);
src/lib/sales/brain/orchestrator.ts:5359:    Array.from(catalogKeywordsSetForAlias || []).map((kw) =>
src/lib/sales/brain/orchestrator.ts:6307:    const allCategories = Array.from(
```

## SHOPIFY_HINTS

```
src/lib/shopify.ts:1:// src/lib/shopify.ts
src/lib/shopify.ts:13:export async function shopifyFetch(query: string, variables: Record<string, any> = {}) {
src/lib/efro/efroSupabaseRepository.ts:160: * Sucht nach is_demo = true oder shop_domain = 'test-shop.myshopify.com' / 'demo'.
src/lib/efro/efroSupabaseRepository.ts:218:    const demoDomains = ["demo", "test-shop.myshopify.com"];
src/lib/fetchShopifyProducts.ts:64:      url: "https://avatarsalespro.myshopify.com/products/tshirt-basic-001",
src/lib/fetchShopifyProducts.ts:75:      url: "https://avatarsalespro.myshopify.com/products/tshirt-premium-001",
src/lib/fetchShopifyProducts.ts:86:      url: "https://avatarsalespro.myshopify.com/products/hoodie-001",
src/lib/products/shopifyLinks.ts:1:// src/lib/products/shopifyLinks.ts
src/lib/products/shopifyLinks.ts:4: * Extrahiert aus einer Shopify GID (z. B. gid://shopify/Product/7512440471619)
src/lib/products/shopifyMapper.ts:1:// src/lib/products/shopifyMapper.ts
src/app/admin/page.tsx:16:    shopify?: string;
src/app/admin/page.tsx:33:      domain: "avatarsalespro.myshopify.com",
src/app/admin/page.tsx:39:        shopify: ""
src/app/admin/page.tsx:47:      domain: "fashionstore.myshopify.com",
src/app/admin/page.tsx:53:        shopify: ""
src/app/admin/page.tsx:108:      domain: "mein-shop.myshopify.com",
src/app/admin/page.tsx:114:        shopify: ""
src/app/admin/page.tsx:229:                      placeholder="mein-shop.myshopify.com"
src/app/admin/page.tsx:311:                        value={currentShop.apiKeys.shopify || ''}
src/app/admin/page.tsx:314:                          apiKeys: {...currentShop.apiKeys, shopify: e.target.value}
src/lib/products/efroProductLoader.ts:12:  source: "shopify" | "mock" | "none";
src/lib/products/efroProductLoader.ts:56:      id: String(p.id ?? `shopify-${index}`),
src/lib/products/efroProductLoader.ts:70: * Versucht echte Produkte aus Shopify zu laden (Ã¼ber /api/shopify-products).
src/lib/products/efroProductLoader.ts:142:    const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
src/lib/products/efroProductLoader.ts:148:    if (shopifyProducts.length === 0) {
src/lib/products/efroProductLoader.ts:152:    let products = mapShopifyToEfro(shopifyProducts);
src/lib/products/efroProductLoader.ts:164:      source: "shopify",
src/lib/products/efroProductLoader.ts:240:    const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
src/lib/products/efroProductLoader.ts:246:    if (!shopifyProducts.length) {
src/lib/products/efroProductLoader.ts:250:    let products = mapShopifyToEfro(shopifyProducts);
src/app/admin/billing/page.tsx:68:    const shop = urlParams.get('shop') || 'mein-shop.myshopify.com';
src/app/admin/billing/page.tsx:75:      const response = await fetch('/api/billing', {
src/app/page.tsx:290:              desc="Du installierst EFRO im Shopify Admin. (Später mit OAuth + Billing)."
src/lib/shops/meta.ts:33:  "snow-demo.myshopify.com": {
src/lib/shops/meta.ts:34:    shopDomain: "snow-demo.myshopify.com",
src/app/avatar-seller/page.tsx:88:      id: String(p.id ?? `shopify-${index}`),
src/app/avatar-seller/page.tsx:1356:        normalizedDomain === "test-shop.myshopify.com";
src/lib/sales/allProductsForShop.ts:38:      id: String(p.id ?? `shopify-${index}`),
src/lib/sales/allProductsForShop.ts:83:        const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
src/lib/sales/allProductsForShop.ts:89:        if (shopifyProducts.length > 0) {
src/lib/sales/allProductsForShop.ts:90:          let products = mapShopifyToEfro(shopifyProducts);
src/lib/sales/allProductsForShop.ts:118:        const res = await fetch(`${baseUrl}/api/shopify-products`, {
src/lib/sales/allProductsForShop.ts:124:          const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
src/lib/sales/allProductsForShop.ts:130:          if (shopifyProducts.length > 0) {
src/lib/sales/allProductsForShop.ts:131:            let products = mapShopifyToEfro(shopifyProducts);
src/lib/sales/aliases.de.dynamic.json:17:      "mapToCategorySlug": "shopify",
src/lib/sales/sellerBrainTypes.ts:85:  shopDomain: string; // z.B. 'test-shop.myshopify.com' oder 'demo'
src/components/EfroProductPanel.tsx:38:    anyProd.shopifyUrl ||
src/app/api/shopify-products/route.ts:5:// src/app/api/shopify-products/route.ts
src/app/api/shopify-products/route.ts:60:      source: "shopify-admin",
src/components/CrossSellingSuggestions.tsx:23:      const response = await fetch(`/api/shopify-products?category=${product.tags}&limit=3`);
src/app/efro/admin/events/page.tsx:118:                placeholder="z. B. test-shop.myshopify.com oder local-dev"
src/app/efro/admin/shops/page.tsx:331:                  Shop-Domain (z. B. <code>test-shop.myshopify.com</code>)
src/app/api/explain-product/route.ts:35:      `${baseUrl}/api/shopify-products?handle=${encodeURIComponent(handle)}`,
src/app/api/explain-product/route.ts:44:          error: "shopify-products returned error",
src/app/api/shopify-webhook/route.ts:13:    const topic = request.headers.get("x-shopify-topic") || "unknown";
src/app/api/landing-chat/route.ts:45:  if (/(install|installation|onboarding|shopify admin|embedded|oauth|billing)/.test(t)) return "install";
src/lib/sales/modules/types/index.ts:42:   * Optionale Shop-Domain (z.B. "demo-shop.myshopify.com"), wird u.a. für
src/app/api/billing/route.ts:4:// src/app/api/billing/route.ts
src/app/api/billing/route.ts:85:        confirmationUrl: "https://dev.local/billing/test-confirmation",
src/app/api/billing/route.ts:106:      !/^.+\.myshopify\.com$/i.test(shop) &&
src/app/api/billing/route.ts:107:      !/^admin\.shopify\.com\/store\//i.test(shop)
src/app/api/billing/route.ts:139:        ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing`
src/app/api/billing/route.ts:140:        : "https://admin.shopify.com");
src/app/api/shopify-import/route.ts:34:    const shopifyUrl = `https://${store}/admin/api/2024-01/products.json`;
src/app/api/shopify-import/route.ts:61:      const res = await fetch(shopifyUrl, {
src/app/api/shopify-import/route.ts:78:          shopifyResponse: json,
src/lib/sales/brain/orchestrator.ts:6891:  shopDomain: string; // z.B. 'test-shop.myshopify.com' oder 'demo'
src/app/api/efro/debug-shop-meta/route.ts:13: *   /api/efro/debug-shop-meta?shop=test-shop.myshopify.com
src/app/api/efro/debug-products/route.ts:30:  shopifyUrl?: string;
src/app/api/efro/debug-products/route.ts:31:  shopifyStatus?: number;
src/app/api/efro/debug-products/route.ts:73:      : "shopify";
src/app/api/efro/debug-products/route.ts:129:    const shopifyUrl = new URL("/api/shopify-products", baseUrl);
src/app/api/efro/debug-products/route.ts:130:    if (shop) shopifyUrl.searchParams.set("shop", shop);
src/app/api/efro/debug-products/route.ts:132:    debug.shopifyUrl = shopifyUrl.toString();
src/app/api/efro/debug-products/route.ts:133:    debug.step = "fetching-shopify";
src/app/api/efro/debug-products/route.ts:135:    const res = await fetch(debug.shopifyUrl, { cache: "no-store" });
src/app/api/efro/debug-products/route.ts:136:    debug.shopifyStatus = res.status;
src/app/api/efro/debug-products/route.ts:139:      debug.step = "shopify-non-200";
src/app/api/efro/debug-products/route.ts:140:      debug.error = `HTTP ${res.status} from /api/shopify-products`;
src/app/api/efro/debug-products/route.ts:157:      debug.step = "shopify-empty";
src/app/api/efro/debug-products/route.ts:160:        "mockCatalog (fallback: /api/shopify-products returned 0 products)";
src/app/api/efro/debug-products/route.ts:169:    debug.productsSource = "shopify-products (mapped to EfroProduct)";
src/app/api/webhooks/gdpr/customer-redact/route.ts:4:// src/app/api/webhooks/gdpr/customer-redact/route.ts
src/app/api/webhooks/gdpr/customer-redact/route.ts:10:  const hmac = req.headers.get("x-shopify-hmac-sha256") || "";
src/app/api/webhooks/app-uninstalled/route.ts:11:  console.log("[webhooks/app-uninstalled] Stub received payload:", bodyText);
src/efro_legacy/dev-pages/dev-chat/page.tsx:14:import { buildShopifyAdminProductUrl } from "../../lib/products/shopifyLinks";
src/efro_legacy/dev-pages/dev-chat/page.tsx:46:  const devShopDomain = "avatarsalespro-dev.myshopify.com";
src/app/api/shopify/callback/route.ts:1:// src/app/api/shopify/callback/route.ts
src/app/api/shopify/callback/route.ts:6: * Minimaler Shopify-OAuth-Callback:
src/app/api/efro/onboard-shop/route.ts:34: *   "shopDomain": "test-shop.myshopify.com",
src/app/api/efro/admin/update-plan/route.ts:10: *   "shopDomain": "test-shop.myshopify.com",
src/app/api/efro/products/route.ts:130:    cleanText(sp.product_type && sp.product_type.trim().length > 0 ? sp.product_type : "shopify") || "shopify";
src/app/api/efro/products/route.ts:178:        const res = await fetch(`${baseUrl}/api/shopify-products`, { cache: "no-store" });
src/app/api/efro/products/route.ts:185:          const payload: any = { success: true, source: "shopify", products, shopDomain: "demo" };
src/app/api/efro/products/route.ts:186:          if (debug) payload.debug = { shopDomain: "demo", isDemo: true, preferredSource: "shopify", forcedSource: null };
src/app/api/efro/suggest/route.ts:227: *   "shop": "avatarsalespro-dev.myshopify.com",
```

DONE.
