import fs from "node:fs";
import path from "node:path";

const files = [
  "src/app/api/shopify-products/route.ts",
  "src/app/api/supabase-products/route.ts",
  "src/app/api/efro/products/route.ts",
];

const helperPath = "src/lib/http/jsonUtf8.ts";

function ensureHelper() {
  fs.mkdirSync(path.dirname(helperPath), { recursive: true });
  if (!fs.existsSync(helperPath)) {
    fs.writeFileSync(
      helperPath,
`import { NextResponse } from "next/server";

export function jsonUtf8(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new NextResponse(JSON.stringify(data), { ...init, headers });
}
`,
      "utf8"
    );
    console.log("created:", helperPath);
  } else {
    console.log("exists:", helperPath);
  }
}

function addImport(t) {
  if (t.includes('from "@/lib/http/jsonUtf8"')) return t;
  const lines = t.split(/\r?\n/);
  const idx = lines.findIndex(
    (l) => l.includes('from "next/server"') || l.includes("from 'next/server'")
  );
  const importLine = 'import { jsonUtf8 } from "@/lib/http/jsonUtf8";';
  if (idx >= 0) lines.splice(idx + 1, 0, importLine);
  else lines.unshift(importLine);
  return lines.join("\n");
}

function removeLocalJsonUtf8(t) {
  // entfernt den lokalen Helper in efro/products, falls vorhanden
  return t.replace(/\nfunction jsonUtf8\([\s\S]*?\n}\n/g, "\n");
}

ensureHelper();

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("[skip missing]", f);
    continue;
  }
  let t = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const before = t;

  if (f.endsWith("src/app/api/efro/products/route.ts")) {
    t = removeLocalJsonUtf8(t);
  }
  t = addImport(t);

  if (t !== before) {
    fs.writeFileSync(f, t, "utf8");
    console.log("patched:", f);
  } else {
    console.log("ok:", f);
  }
}
