import { NextResponse } from "next/server";
import { sanitizeDeep } from "@/lib/text/encoding";

export function jsonUtf8(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  // FINAL: egal was irgendwo kaputt reinkommt -> niemals kaputt rausgeben
  const safe = sanitizeDeep(data);

  return new NextResponse(JSON.stringify(safe), { ...init, headers });
}
