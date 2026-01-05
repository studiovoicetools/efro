export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

function env(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      now: new Date().toISOString(),
      node: process.version,
      env: {
        NODE_ENV: env("NODE_ENV"),
        RENDER_GIT_COMMIT: env("RENDER_GIT_COMMIT"),
        VERCEL_GIT_COMMIT_SHA: env("VERCEL_GIT_COMMIT_SHA"),
        GITHUB_SHA: env("GITHUB_SHA"),
      },
    },
    { status: 200 }
  );
}
