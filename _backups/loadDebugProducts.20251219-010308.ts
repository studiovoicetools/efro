import fs from "node:fs";
import path from "node:path";

type LoadResult<T = unknown> = { products: T; source: "api" | "fixture" };

function readFixture<T = unknown>(fixtureRelPath: string): T {
  const fixtureAbs = path.resolve(process.cwd(), fixtureRelPath);
  const raw = fs.readFileSync(fixtureAbs, "utf8");
  return JSON.parse(raw) as T;
}

function extractProducts<T = unknown>(json: any): T {
  return (json?.products ?? json) as T;
}


export async function loadDebugProducts<T = unknown>(opts?: {
  url?: string;
  fixturePath?: string;
  timeoutMs?: number;
}): Promise<LoadResult<T>> {
  const url =
    opts?.url ??
    process.env.EFRO_DEBUG_PRODUCTS_URL ??
    "http://localhost:3000/api/efro/debug-products?shop=local-dev";

  const fixturePath = opts?.fixturePath ?? "scripts/fixtures/products.local.json";
  const timeoutMs = opts?.timeoutMs ?? 4000;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as any;
	const products = extractProducts<T>(json);
	return { products, source: "api" };

  } catch (err: any) {
    const fixtureJson = readFixture<any>(fixturePath);
	const products = extractProducts<T>(fixtureJson);

    console.warn(
      `[sellerbrain:scenarios] Debug API unreachable (${String(err?.message ?? err)}). Using fixture: ${fixturePath}`
    );
    return { products, source: "fixture" };
  }
}
