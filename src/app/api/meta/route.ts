export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

export async function GET() {
  const pick = (k: string) => (process.env[k] ? String(process.env[k]) : null);

  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    node_env: pick("NODE_ENV"),
    render: {
      git_commit: pick("RENDER_GIT_COMMIT"),
      git_branch: pick("RENDER_GIT_BRANCH"),
      service_name: pick("RENDER_SERVICE_NAME"),
      external_url: pick("RENDER_EXTERNAL_URL"),
    },
    app: {
      next_public_app_url: pick("NEXT_PUBLIC_APP_URL"),
      shopify_app_url: pick("SHOPIFY_APP_URL"),
      shopify_scopes: pick("SHOPIFY_SCOPES"),
      api_key_present: !!process.env.SHOPIFY_API_KEY,
      secret_present: !!(process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET),
    },
  });
}
