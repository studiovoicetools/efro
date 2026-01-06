export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/efro/commerce/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  CommerceActionRequest,
  CommerceActionResponse,
  CommerceAction,
} from "@/lib/efro/commerce/commerceTypes";

const ADMIN_VERSION = "2024-07";

function normalizeShopToMyshopify(raw: string): string | null {
  const s = (raw || "").trim().toLowerCase();

  // Support: admin.shopify.com/store/<handle>
  const m = s.match(/^admin\.shopify\.com\/store\/([^/?#]+)/i);
  if (m?.[1]) return `${m[1]}.myshopify.com`;

  // Standard: <handle>.myshopify.com
  if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(s)) return s;

  return null;
}

function safeId(prefix: string) {
  try {
    // Node 20+ has randomUUID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  }
}

async function adminGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const url = `https://${shop}/admin/api/${ADMIN_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Shopify HTTP ${res.status}: ${text.slice(0, 800)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Shopify JSON parse failed: ${text.slice(0, 800)}`);
  }
}

async function resolveAccessToken(shop: string): Promise<{ token: string; tokenSource: string }> {
  // 1) Prefer Supabase shops.access_token
  const supabase = createAdminSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("shops")
      .select("access_token, updated_at")
      .eq("shop", shop)
      .maybeSingle();

    if (!error) {
      const tok = (data as any)?.access_token;
      if (typeof tok === "string" && tok.trim()) {
        return { token: tok.trim(), tokenSource: "supabase.shops.access_token" };
      }
    }
  }

  // 2) Fallback ENV (dev/emergency)
  const envTok = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim();
  if (envTok) return { token: envTok, tokenSource: "env.SHOPIFY_ADMIN_ACCESS_TOKEN" };

  throw new Error("No Shopify Admin access token available (shops.access_token empty and SHOPIFY_ADMIN_ACCESS_TOKEN missing)");
}

function badRequest(msg: string, correlationId: string, shop: string, actionType: string): NextResponse {
  const out: CommerceActionResponse = {
    ok: false,
    shop,
    correlationId,
    actionType: actionType as any,
    error: msg,
  };
  return NextResponse.json(out, { status: 400 });
}

export async function POST(req: NextRequest) {
  const correlationId = safeId("corr");

  let shopForError = "unknown";
  let actionTypeForError: "CREATE_DRAFT_ORDER_CHECKOUT" | "UPDATE_DRAFT_ORDER_LINE_QTY" = "CREATE_DRAFT_ORDER_CHECKOUT";

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CommerceActionRequest>;

    const rawShop = typeof body.shop === "string" ? body.shop : "";
    const shop = normalizeShopToMyshopify(rawShop) || "";
      shopForError = shop || "unknown";
    const action = body.action as CommerceAction | undefined;

    if (!shop) {
      return badRequest("Missing/invalid 'shop' (expected <handle>.myshopify.com or admin.shopify.com/store/<handle>)", correlationId, "unknown", "unknown");
    }

    if (!action || typeof action !== "object" || typeof (action as any).type !== "string") {
      return badRequest("Missing/invalid 'action'", correlationId, shop, "unknown");
    }

    const actionType = (action as any).type as string;


      actionTypeForError = actionType === "UPDATE_DRAFT_ORDER_LINE_QTY"
        ? "UPDATE_DRAFT_ORDER_LINE_QTY"
        : "CREATE_DRAFT_ORDER_CHECKOUT";

    const { token: accessToken, tokenSource } = await resolveAccessToken(shop);

    if (actionType === "CREATE_DRAFT_ORDER_CHECKOUT") {
      const variantId = (action as any).variantId;
      const quantity = (action as any).quantity;
      const discountPercent = (action as any).discountPercent ?? null;
      const email = (action as any).email ?? null;

      if (typeof variantId !== "string" || !variantId.trim().startsWith("gid://shopify/ProductVariant/")) {
        return badRequest("Invalid 'variantId' (expected gid://shopify/ProductVariant/...)", correlationId, shop, actionType);
      }
      if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
        return badRequest("Invalid 'quantity' (must be > 0)", correlationId, shop, actionType);
      }

      const MUT = `
        mutation CreateDraft($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            userErrors { field message }
            draftOrder {
              id
              status
              invoiceUrl
            }
          }
        }
      `;

      const input: any = {
        lineItems: [{ variantId: variantId.trim(), quantity }],
      };

      if (typeof email === "string" && email.trim()) input.email = email.trim();

      // Optional: discountPercent
      if (typeof discountPercent === "number" && Number.isFinite(discountPercent) && discountPercent > 0) {
        input.appliedDiscount = {
          valueType: "PERCENTAGE",
          value: discountPercent,
          title: "EFRO Discount",
          description: "EFRO Discount",
        };
      }
        const r = await adminGraphQL<any>(shop, accessToken, MUT, { input });

        // Shopify GraphQL may return top-level `errors` even with HTTP 200
        const gqlErrors = Array.isArray((r as any)?.errors) ? (r as any).errors : [];
        if (gqlErrors.length) {
          const msg = gqlErrors
            .map((e: any) => e?.message)
            .filter(Boolean)
            .join(" | ");
          const out: CommerceActionResponse = {
            ok: false,
            shop,
            correlationId,
            actionType: actionTypeForError,
            error: `Shopify GraphQL errors: ${msg || "unknown"}`,
            result: { tokenSource, graphQLErrors: gqlErrors },
          };
          return NextResponse.json(out, { status: 502 });
        }

        const payload = r?.data?.draftOrderCreate;
        if (!payload) {
          const out: CommerceActionResponse = {
            ok: false,
            shop,
            correlationId,
            actionType: "CREATE_DRAFT_ORDER_CHECKOUT",
            error: "Shopify response missing draftOrderCreate payload (data.draftOrderCreate is null/undefined)",
            result: { tokenSource, responseKeys: Object.keys(r || {}) },
          };
          return NextResponse.json(out, { status: 502 });
        }

        const errs = payload?.userErrors || [];
        const draft = payload?.draftOrder;

        // Must have an id + invoiceUrl for a checkout action
        if (!draft?.id || !draft?.invoiceUrl) {
          const out: CommerceActionResponse = {
            ok: false,
            shop,
            correlationId,
            actionType: "CREATE_DRAFT_ORDER_CHECKOUT",
            error: "Draft order not created (missing draft.id and/or draft.invoiceUrl). Likely missing scopes (write_draft_orders).",
            result: { tokenSource, draft: draft ?? null, userErrors: errs },
          };
          return NextResponse.json(out, { status: 502 });
        }


      if (errs.length) {
        const out: CommerceActionResponse = {
          ok: false,
          shop,
          correlationId,
          actionType: "CREATE_DRAFT_ORDER_CHECKOUT",
          error: `Shopify userErrors: ${errs.map((e: any) => e?.message).filter(Boolean).join(" | ")}`,
          result: { tokenSource, userErrors: errs },
        };
        return NextResponse.json(out, { status: 400 });
      }

      const out: CommerceActionResponse = {
        ok: true,
        shop,
        correlationId,
        actionType: "CREATE_DRAFT_ORDER_CHECKOUT",
        result: {
          tokenSource,
          draftOrderId: draft?.id ?? null,
          status: draft?.status ?? null,
          invoiceUrl: draft?.invoiceUrl ?? null,
        },
      };
      return NextResponse.json(out, { status: 200 });
    }

    if (actionType === "UPDATE_DRAFT_ORDER_LINE_QTY") {
      const draftOrderId = (action as any).draftOrderId;
      const lineItemUuid = (action as any).lineItemUuid;
      const quantity = (action as any).quantity;

      if (typeof draftOrderId !== "string" || !draftOrderId.trim().startsWith("gid://shopify/DraftOrder/")) {
        return badRequest("Invalid 'draftOrderId' (expected gid://shopify/DraftOrder/...)", correlationId, shop, actionType);
      }
      if (typeof lineItemUuid !== "string" || !lineItemUuid.trim()) {
        return badRequest("Invalid 'lineItemUuid' (expected non-empty uuid string)", correlationId, shop, actionType);
      }
      if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
        return badRequest("Invalid 'quantity' (must be > 0)", correlationId, shop, actionType);
      }

      // 1) Read existing line items (safe update = read → rebuild lineItems → update)
      const Q = `
        query DraftOrderLineItems($id: ID!, $first: Int!) {
          node(id: $id) {
            ... on DraftOrder {
              id
              invoiceUrl
              status
              lineItems(first: $first) {
                edges {
                  node {
                    uuid
                    quantity
                    variant { id }
                  }
                }
              }
            }
          }
        }
      `;
      const qr = await adminGraphQL<any>(shop, accessToken, Q, { id: draftOrderId.trim(), first: 50 });
      const node = qr?.data?.node;

      if (!node?.id) {
        const out: CommerceActionResponse = {
          ok: false,
          shop,
          correlationId,
          actionType: "UPDATE_DRAFT_ORDER_LINE_QTY",
          error: "DraftOrder not found (node(id) returned null)",
          result: { tokenSource },
        };
        return NextResponse.json(out, { status: 404 });
      }

      const edges = node?.lineItems?.edges || [];
      const items = edges
        .map((e: any) => e?.node)
        .filter(Boolean)
        .map((n: any) => ({
          uuid: n.uuid,
          quantity: n.quantity,
          variantId: n?.variant?.id ?? null,
        }))
        .filter((n: any) => typeof n.uuid === "string" && n.uuid && typeof n.variantId === "string" && n.variantId);

      const exists = items.some((it: any) => it.uuid === lineItemUuid.trim());
      if (!exists) {
        const out: CommerceActionResponse = {
          ok: false,
          shop,
          correlationId,
          actionType: "UPDATE_DRAFT_ORDER_LINE_QTY",
          error: "lineItemUuid not found on draft order",
          result: { tokenSource, knownUuids: items.map((x: any) => x.uuid) },
        };
        return NextResponse.json(out, { status: 400 });
      }

      const newLineItems = items.map((it: any) => ({
        uuid: it.uuid,
        variantId: it.variantId,
        quantity: it.uuid === lineItemUuid.trim() ? quantity : it.quantity,
      }));

      // 2) Update draft order
      const MUT = `
        mutation UpdateDraft($id: ID!, $input: DraftOrderInput!) {
          draftOrderUpdate(id: $id, input: $input) {
            userErrors { field message }
            draftOrder {
              id
              status
              invoiceUrl
            }
          }
        }
      `;
        const ur = await adminGraphQL<any>(shop, accessToken, MUT, {
          id: draftOrderId.trim(),
          input: { lineItems: newLineItems },
        });

        const gqlErrors = Array.isArray((ur as any)?.errors) ? (ur as any).errors : [];
        if (gqlErrors.length) {
          const msg = gqlErrors
            .map((e: any) => e?.message)
            .filter(Boolean)
            .join(" | ");
          const out: CommerceActionResponse = {
            ok: false,
            shop,
            correlationId,
            actionType: "UPDATE_DRAFT_ORDER_LINE_QTY",
            error: `Shopify GraphQL errors: ${msg || "unknown"}`,
            result: { tokenSource, graphQLErrors: gqlErrors },
          };
          return NextResponse.json(out, { status: 502 });
        }

        const payload = ur?.data?.draftOrderUpdate;
        if (!payload) {
          const out: CommerceActionResponse = {
            ok: false,
            shop,
            correlationId,
            actionType: "UPDATE_DRAFT_ORDER_LINE_QTY",
            error: "Shopify response missing draftOrderUpdate payload (data.draftOrderUpdate is null/undefined)",
            result: { tokenSource, responseKeys: Object.keys(ur || {}) },
          };
          return NextResponse.json(out, { status: 502 });
        }

        const errs = payload?.userErrors || [];
        const draft = payload?.draftOrder;

        if (!draft?.id) {
          const out: CommerceActionResponse = {
            ok: false,
            shop,
            correlationId,
            actionType: "UPDATE_DRAFT_ORDER_LINE_QTY",
            error: "Draft order update returned no draft.id (unexpected).",
            result: { tokenSource, draft: draft ?? null, userErrors: errs },
          };
          return NextResponse.json(out, { status: 502 });
        }


      if (errs.length) {
        const out: CommerceActionResponse = {
          ok: false,
          shop,
          correlationId,
          actionType: "UPDATE_DRAFT_ORDER_LINE_QTY",
          error: `Shopify userErrors: ${errs.map((e: any) => e?.message).filter(Boolean).join(" | ")}`,
          result: { tokenSource, userErrors: errs },
        };
        return NextResponse.json(out, { status: 400 });
      }

      const out: CommerceActionResponse = {
        ok: true,
        shop,
        correlationId,
        actionType: "UPDATE_DRAFT_ORDER_LINE_QTY",
        result: {
          tokenSource,
          draftOrderId: draft?.id ?? null,
          status: draft?.status ?? null,
          invoiceUrl: draft?.invoiceUrl ?? null,
          updatedLineItemUuid: lineItemUuid.trim(),
          quantity,
        },
      };
      return NextResponse.json(out, { status: 200 });
    }

    return badRequest(`Unknown action.type: ${actionType}`, correlationId, shop, actionType);
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    const out: CommerceActionResponse = {
      ok: false,
      shop: shopForError,
      correlationId,
      actionType: "CREATE_DRAFT_ORDER_CHECKOUT",
      error: msg,
    };
    return NextResponse.json(out, { status: 500 });
  }
}
