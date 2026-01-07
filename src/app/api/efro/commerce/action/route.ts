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
  CommerceActionType,
  CommerceError,
  CommerceErrorCode,
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
    return (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  }
}

function sanitizeCorrelationId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  // allow typical ids (uuid, gate2-..., etc)
  if (v.length > 128) return null;
  if (!/^[a-zA-Z0-9._:-]+$/.test(v)) return null;
  return v;
}

function isDebugEnabled(req: NextRequest, body: Partial<CommerceActionRequest>): boolean {
  const h = (req.headers.get("x-efro-debug") || "").trim().toLowerCase();
  if (h === "1" || h === "true" || h === "yes") return true;
  return body.debug === true;
}

function errObj(code: CommerceErrorCode, message: string, details?: unknown): CommerceError {
  const e: CommerceError = { code, message };
  if (details !== undefined) e.details = details;
  return e;
}

function json(out: CommerceActionResponse, status: number) {
  return NextResponse.json(out, { status });
}

function errorResponse(params: {
  status: number;
  code: CommerceErrorCode;
  message: string;
  correlationId: string;
  shop: string;
  actionType: CommerceActionType;
  details?: unknown;
}): NextResponse {
  const out: CommerceActionResponse = {
    ok: false,
    shop: params.shop,
    correlationId: params.correlationId,
    actionType: params.actionType,
    error: errObj(params.code, params.message, params.details),
  };
  return json(out, params.status);
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
    const ex: any = new Error(`Shopify HTTP ${res.status}`);
    ex.httpStatus = res.status;
    ex.body = text.slice(0, 800);
    throw ex;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const ex: any = new Error("Shopify JSON parse failed");
    ex.body = text.slice(0, 800);
    throw ex;
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

  const ex: any = new Error("No Shopify Admin access token available for this shop");
  ex.code = "NO_TOKEN";
  throw ex;
}

type ActionLogRow = {
  shop: string;
  correlation_id: string;
  action_type: string;
  ok?: boolean;
  status_code?: number | null;
  draft_order_id?: string | null;
  invoice_url?: string | null;
  duration_ms?: number | null;
  token_source?: string | null;
  result?: any | null;
  error?: any | null;
};

async function tryBeginActionLog(params: {
  shop: string;
  correlationId: string;
  actionType: CommerceActionType;
  debug: boolean;
}): Promise<
  | { mode: "disabled" }
  | { mode: "new" }
  | { mode: "replay_ok"; statusCode: number; result: any }
  | { mode: "replay_fail"; statusCode: number; error: any }
  | { mode: "conflict" }
> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { mode: "disabled" };

  const baseKey = {
    shop: params.shop,
    correlation_id: params.correlationId,
    action_type: params.actionType,
  };

  // Insert "start" row. If the table doesn't exist yet, we disable logging (no crash).
  const ins = await supabase.from("efro_action_log").insert(baseKey).select("*").maybeSingle();

  if (!ins.error) return { mode: "new" };

  const msg = String((ins.error as any)?.message || "");
  const code = String((ins.error as any)?.code || "");

  // Table missing -> disable
  if (msg.toLowerCase().includes("relation") && msg.toLowerCase().includes("efro_action_log")) {
    console.warn("[EFRO COMMERCE] action_log table missing; idempotency disabled until migration is applied");
    return { mode: "disabled" };
  }

  // Unique violation -> replay logic
  if (code === "23505" || msg.toLowerCase().includes("duplicate")) {
    const sel = await supabase
      .from("efro_action_log")
      .select("ok,status_code,result,error")
      .eq("shop", params.shop)
      .eq("correlation_id", params.correlationId)
      .eq("action_type", params.actionType)
      .maybeSingle();

    if (!sel.error && sel.data) {
      const ok = Boolean((sel.data as any).ok);
      const statusCode = Number((sel.data as any).status_code || (ok ? 200 : 409));
      if (ok) return { mode: "replay_ok", statusCode, result: (sel.data as any).result ?? null };
      if ((sel.data as any).error) return { mode: "replay_fail", statusCode, error: (sel.data as any).error };
      return { mode: "conflict" };
    }

    return { mode: "conflict" };
  }

  // Any other insert error: disable (do not break prod)
  console.warn("[EFRO COMMERCE] action_log insert failed; idempotency disabled", { code, msg });
  return { mode: "disabled" };
}

async function finalizeActionLog(params: {
  shop: string;
  correlationId: string;
  actionType: CommerceActionType;
  patch: Partial<ActionLogRow>;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("efro_action_log")
    .update(params.patch)
    .eq("shop", params.shop)
    .eq("correlation_id", params.correlationId)
    .eq("action_type", params.actionType);

  if (error) {
    // never break request flow
    console.warn("[EFRO COMMERCE] action_log update failed", { message: (error as any).message, code: (error as any).code });
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // defaults for catch
  let shopForError = "unknown";
  let actionTypeForError: CommerceActionType = "CREATE_DRAFT_ORDER_CHECKOUT";
  let correlationId = safeId("corr");

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CommerceActionRequest>;

    const rawShop = typeof body.shop === "string" ? body.shop : "";
    const shop = normalizeShopToMyshopify(rawShop) || "";
    shopForError = shop || "unknown";

    const action = body.action as CommerceAction | undefined;
    const debug = isDebugEnabled(req, body);

    // correlationId: prefer request value (needed for idempotency)
    const corrIn = sanitizeCorrelationId(body.correlationId);
    if (corrIn) correlationId = corrIn;

    if (!shop) {
      return errorResponse({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Missing/invalid 'shop' (expected <handle>.myshopify.com or admin.shopify.com/store/<handle>)",
        correlationId,
        shop: "unknown",
        actionType: actionTypeForError,
      });
    }

    if (!action || typeof action !== "object" || typeof (action as any).type !== "string") {
      return errorResponse({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Missing/invalid 'action'",
        correlationId,
        shop,
        actionType: actionTypeForError,
      });
    }

    const actionType = (action as any).type as string;
    actionTypeForError =
      actionType === "UPDATE_DRAFT_ORDER_LINE_QTY"
        ? "UPDATE_DRAFT_ORDER_LINE_QTY"
        : "CREATE_DRAFT_ORDER_CHECKOUT";

    // Idempotency/audit begin (works once the migration is applied; safe fallback if not).
    const begin = await tryBeginActionLog({
      shop,
      correlationId,
      actionType: actionTypeForError,
      debug,
    });

    if (begin.mode === "replay_ok") {
      const durationMs = Date.now() - startedAt;
      console.log("[EFRO COMMERCE] replay_ok", {
        shop,
        correlationId,
        actionType: actionTypeForError,
        ok: true,
        durationMs,
      });

      const out: CommerceActionResponse = {
        ok: true,
        shop,
        correlationId,
        actionType: actionTypeForError,
        result: begin.result ?? null,
      };
      return json(out, begin.statusCode || 200);
    }

    if (begin.mode === "replay_fail") {
      const durationMs = Date.now() - startedAt;
      console.log("[EFRO COMMERCE] replay_fail", {
        shop,
        correlationId,
        actionType: actionTypeForError,
        ok: false,
        durationMs,
      });

      const out: CommerceActionResponse = {
        ok: false,
        shop,
        correlationId,
        actionType: actionTypeForError,
        error: begin.error,
      };
      return json(out, begin.statusCode || 409);
    }

    if (begin.mode === "conflict") {
      return errorResponse({
        status: 409,
        code: "CONFLICT",
        message: "Duplicate correlationId for this actionType. Use a new correlationId or retry later.",
        correlationId,
        shop,
        actionType: actionTypeForError,
      });
    }

    // Continue with real execution
    const { token: accessToken, tokenSource } = await resolveAccessToken(shop);

    if (actionType === "CREATE_DRAFT_ORDER_CHECKOUT") {
      const variantId = (action as any).variantId;
      const quantity = (action as any).quantity;
      const discountPercent = (action as any).discountPercent ?? null;
      const email = (action as any).email ?? null;

      if (typeof variantId !== "string" || !variantId.trim().startsWith("gid://shopify/ProductVariant/")) {
        return errorResponse({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Invalid 'variantId' (expected gid://shopify/ProductVariant/...)",
          correlationId,
          shop,
          actionType: actionTypeForError,
        });
      }
      if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
        return errorResponse({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Invalid 'quantity' (must be > 0)",
          correlationId,
          shop,
          actionType: actionTypeForError,
        });
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

      if (typeof discountPercent === "number" && Number.isFinite(discountPercent) && discountPercent > 0) {
        input.appliedDiscount = {
          valueType: "PERCENTAGE",
          value: discountPercent,
          title: "EFRO Discount",
          description: "EFRO Discount",
        };
      }

      const r = await adminGraphQL<any>(shop, accessToken, MUT, { input });

      const gqlErrors = Array.isArray((r as any)?.errors) ? (r as any).errors : [];
      if (gqlErrors.length) {
        const msg = gqlErrors.map((e: any) => e?.message).filter(Boolean).join(" | ");
        const e = errObj("SHOPIFY_ERROR", `Shopify GraphQL errors: ${msg || "unknown"}`, debug ? { graphQLErrors: gqlErrors } : undefined);

        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 502,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });

        console.log("[EFRO COMMERCE]", {
          shop,
          correlationId,
          actionType: actionTypeForError,
          ok: false,
          durationMs: Date.now() - startedAt,
          tokenSource,
        });

        const out: CommerceActionResponse = { ok: false, shop, correlationId, actionType: actionTypeForError, error: e };
        return json(out, 502);
      }

      const payload = r?.data?.draftOrderCreate;
      if (!payload) {
        const e = errObj("SHOPIFY_ERROR", "Shopify response missing draftOrderCreate payload");
        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 502,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });
        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 502);
      }

      const errs = payload?.userErrors || [];
      const draft = payload?.draftOrder;

      if (errs.length) {
        const e = errObj(
          "VALIDATION_ERROR",
          `Shopify userErrors: ${errs.map((x: any) => x?.message).filter(Boolean).join(" | ")}`,
          debug ? { userErrors: errs } : undefined
        );

        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 400,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });

        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 400);
      }

      if (!draft?.id || !draft?.invoiceUrl) {
        const e = errObj(
          "SHOPIFY_ERROR",
          "Draft order not created (missing draft.id and/or draft.invoiceUrl). Likely missing scopes (write_draft_orders).",
          debug ? { draft: draft ?? null } : undefined
        );

        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 502,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });

        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 502);
      }

      const result = {
        draftOrderId: draft.id ?? null,
        status: draft.status ?? null,
        invoiceUrl: draft.invoiceUrl ?? null,
        ...(debug ? { tokenSource } : {}),
      };

      await finalizeActionLog({
        shop,
        correlationId,
        actionType: actionTypeForError,
        patch: {
          ok: true,
          status_code: 200,
          draft_order_id: draft.id ?? null,
          invoice_url: draft.invoiceUrl ?? null,
          duration_ms: Date.now() - startedAt,
          token_source: tokenSource,
          result,
          error: null,
        },
      });

      console.log("[EFRO COMMERCE]", {
        shop,
        correlationId,
        actionType: actionTypeForError,
        ok: true,
        draftOrderId: draft.id,
        durationMs: Date.now() - startedAt,
        tokenSource,
      });

      return json(
        {
          ok: true,
          shop,
          correlationId,
          actionType: "CREATE_DRAFT_ORDER_CHECKOUT",
          result,
        },
        200
      );
    }

    if (actionType === "UPDATE_DRAFT_ORDER_LINE_QTY") {
      const draftOrderId = (action as any).draftOrderId;
      const lineItemUuid = (action as any).lineItemUuid;
      const quantity = (action as any).quantity;

      if (typeof draftOrderId !== "string" || !draftOrderId.trim().startsWith("gid://shopify/DraftOrder/")) {
        return errorResponse({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Invalid 'draftOrderId' (expected gid://shopify/DraftOrder/...)",
          correlationId,
          shop,
          actionType: actionTypeForError,
        });
      }
      if (typeof lineItemUuid !== "string" || !lineItemUuid.trim()) {
        return errorResponse({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Invalid 'lineItemUuid' (expected non-empty uuid string)",
          correlationId,
          shop,
          actionType: actionTypeForError,
        });
      }
      if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
        return errorResponse({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Invalid 'quantity' (must be > 0)",
          correlationId,
          shop,
          actionType: actionTypeForError,
        });
      }

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
        const e = errObj("NOT_FOUND", "DraftOrder not found (node(id) returned null)");
        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 404,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });
        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 404);
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
        const known = items.map((x: any) => x.uuid);
        const e = errObj(
          "VALIDATION_ERROR",
          "lineItemUuid not found on draft order",
          debug ? { knownUuids: known } : undefined
        );

        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 400,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });

        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 400);
      }

      const newLineItems = items.map((it: any) => ({
        uuid: it.uuid,
        variantId: it.variantId,
        quantity: it.uuid === lineItemUuid.trim() ? quantity : it.quantity,
      }));

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
        const msg = gqlErrors.map((e: any) => e?.message).filter(Boolean).join(" | ");
        const e = errObj("SHOPIFY_ERROR", `Shopify GraphQL errors: ${msg || "unknown"}`, debug ? { graphQLErrors: gqlErrors } : undefined);

        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 502,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });

        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 502);
      }

      const payload = ur?.data?.draftOrderUpdate;
      if (!payload) {
        const e = errObj("SHOPIFY_ERROR", "Shopify response missing draftOrderUpdate payload");
        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 502,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });
        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 502);
      }

      const errs = payload?.userErrors || [];
      const draft = payload?.draftOrder;

      if (errs.length) {
        const e = errObj(
          "VALIDATION_ERROR",
          `Shopify userErrors: ${errs.map((x: any) => x?.message).filter(Boolean).join(" | ")}`,
          debug ? { userErrors: errs } : undefined
        );

        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 400,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });

        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 400);
      }

      if (!draft?.id) {
        const e = errObj("SHOPIFY_ERROR", "Draft order update returned no draft.id (unexpected).", debug ? { draft: draft ?? null } : undefined);
        await finalizeActionLog({
          shop,
          correlationId,
          actionType: actionTypeForError,
          patch: {
            ok: false,
            status_code: 502,
            duration_ms: Date.now() - startedAt,
            token_source: tokenSource,
            error: e,
          },
        });
        return json({ ok: false, shop, correlationId, actionType: actionTypeForError, error: e }, 502);
      }

      const result = {
        draftOrderId: draft.id ?? null,
        status: draft.status ?? null,
        invoiceUrl: draft.invoiceUrl ?? null,
        updatedLineItemUuid: lineItemUuid.trim(),
        quantity,
        ...(debug ? { tokenSource } : {}),
      };

      await finalizeActionLog({
        shop,
        correlationId,
        actionType: actionTypeForError,
        patch: {
          ok: true,
          status_code: 200,
          draft_order_id: draft.id ?? null,
          invoice_url: draft.invoiceUrl ?? null,
          duration_ms: Date.now() - startedAt,
          token_source: tokenSource,
          result,
          error: null,
        },
      });

      console.log("[EFRO COMMERCE]", {
        shop,
        correlationId,
        actionType: actionTypeForError,
        ok: true,
        draftOrderId: draft.id,
        durationMs: Date.now() - startedAt,
        tokenSource,
      });

      return json(
        {
          ok: true,
          shop,
          correlationId,
          actionType: "UPDATE_DRAFT_ORDER_LINE_QTY",
          result,
        },
        200
      );
    }

    return errorResponse({
      status: 400,
      code: "VALIDATION_ERROR",
      message: `Unknown action.type: ${actionType}`,
      correlationId,
      shop,
      actionType: actionTypeForError,
    });
  } catch (e: any) {
    const durationMs = Date.now() - startedAt;

    const shop = shopForError;
    const actionType = actionTypeForError;

    const msg = e instanceof Error ? e.message : String(e);
    const httpStatus = Number((e as any)?.httpStatus || 0);
    const rawBody = (e as any)?.body;

    // Map known token case
    if ((e as any)?.code === "NO_TOKEN") {
      const err = errObj("UNAUTHORIZED", "No Shopify Admin access token available for this shop");
      await finalizeActionLog({
        shop,
        correlationId,
        actionType,
        patch: { ok: false, status_code: 401, duration_ms: durationMs, error: err },
      });
      console.log("[EFRO COMMERCE]", { shop, correlationId, actionType, ok: false, durationMs, reason: "NO_TOKEN" });
      return json({ ok: false, shop, correlationId, actionType, error: err }, 401);
    }

    // Shopify HTTP/parse errors
    if (msg.startsWith("Shopify HTTP") || msg.includes("Shopify JSON parse failed")) {
      const details = (httpStatus || rawBody) && (req.headers.get("x-efro-debug") === "1") ? { httpStatus, rawBody } : undefined;
      const err = errObj("SHOPIFY_ERROR", msg, details);

      await finalizeActionLog({
        shop,
        correlationId,
        actionType,
        patch: { ok: false, status_code: 502, duration_ms: durationMs, error: err },
      });

      console.log("[EFRO COMMERCE]", { shop, correlationId, actionType, ok: false, durationMs, reason: "SHOPIFY_HTTP" });
      return json({ ok: false, shop, correlationId, actionType, error: err }, 502);
    }

    const err = errObj("INTERNAL", msg);
    await finalizeActionLog({
      shop,
      correlationId,
      actionType,
      patch: { ok: false, status_code: 500, duration_ms: durationMs, error: err },
    });

    console.log("[EFRO COMMERCE]", { shop, correlationId, actionType, ok: false, durationMs, reason: "INTERNAL" });
    return json({ ok: false, shop, correlationId, actionType, error: err }, 500);
  }
}
