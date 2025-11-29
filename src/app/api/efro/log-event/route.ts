import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type LogPayload = {
  shopDomain?: string | null;
  userText?: string | null;
  intent?: string | null;
  productCount?: number | null;
  plan?: string | null;
  hadError?: boolean | null;
  errorMessage?: string | null;
};

export async function POST(req: Request) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "supabase-not-configured" },
      { status: 500 },
    );
  }

  let body: LogPayload;
  try {
    body = (await req.json()) as LogPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json-body" },
      { status: 400 },
    );
  }

  const {
    shopDomain,
    userText,
    intent,
    productCount,
    plan,
    hadError,
    errorMessage,
  } = body;

  // Debug-Log vor dem Insert
  console.log("[EFRO LogEvent WRITE]", {
    shopDomain,
    intent,
    productCount,
    hadError,
  });

  try {
    const { data, error } = await supabase
      .from("efro_events")
      .insert({
        shop_domain: shopDomain ?? null,
        user_text: userText ?? null,
        intent: intent ?? null,
        product_count: productCount ?? null,
        plan: plan ?? null,
        had_error: hadError ?? false,
        error_message: errorMessage ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[EFRO log-event] Insert failed", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    console.log("[EFRO log-event] Insert successful", {
      id: data?.id,
      shopDomain,
      intent,
    });

    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (err: any) {
    console.error("[EFRO log-event] Unexpected error", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ? String(err.message) : "unknown-error",
      },
      { status: 500 },
    );
  }
}
