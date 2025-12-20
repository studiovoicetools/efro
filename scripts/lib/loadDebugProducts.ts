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

export async function loadDebugProducts<T = unknown>(optsOrUrl: string | { url?: string; fixturePath?: string; timeoutMs?: number; allowFixtureFallback?: boolean }): Promise<LoadResult<T>> {
  const opts =
    typeof optsOrUrl === "string"
      ? { url: optsOrUrl as string }
      : optsOrUrl || {};

  const url = opts.url;
  const fixturePath = opts.fixturePath;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const allowFixtureFallback =
    opts.allowFixtureFallback ??
    (process.env.EFRO_ALLOW_FIXTURE_FALLBACK === "1");

  // Try fetch from API if URL provided
  if (url) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(t);

      if (!res.ok) {
        throw new Error(`Debug API returned non-ok status ${res.status}`);
      }

      const json = (await res.json()) as any;
      const products = extractProducts<T>(json);
      return { products, source: "api" };
    } catch (err) {
      // On failure, decide based on allowFixtureFallback
      if (!allowFixtureFallback) {
        throw new Error(
          `Failed to fetch debug products from API (${String(url)}): ${String(
            (err as Error)?.message ?? err
          )} — fixture fallback disabled`
        );
      }
      // else fall through to fixture
    }
  }

  // Fixture fallback path
  if (!fixturePath) {
    throw new Error(`Fixture path not provided and API fetch failed or not attempted.`);
  }

  const absPath = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.join(process.cwd(), fixturePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Fixture file not found: ${absPath}`);
  }

  const raw = fs.readFileSync(absPath, "utf8");
  const parsed = JSON.parse(raw);
  const products = (parsed && (parsed.products ?? parsed)) as T;

  return { products, source: "fixture" };
}
