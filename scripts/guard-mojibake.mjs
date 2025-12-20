// scripts/guard-mojibake.mjs
const MOJIBAKE_RE = /Ã|Â|â€|â€™|â€œ|â€�|â€“|â€”|â€¦|â‚¬|â„¢|â¬|�/;

function scanValue(path, v, hits) {
  if (v == null) return;
  if (typeof v === "string") {
    if (MOJIBAKE_RE.test(v)) hits.push({ path, value: v.slice(0, 180) });
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => scanValue(`${path}[${i}]`, x, hits));
    return;
  }
  if (typeof v === "object") {
    for (const [k, x] of Object.entries(v)) scanValue(`${path}.${k}`, x, hits);
  }
}

async function main() {
  const base = process.env.EFRO_BASE_URL || "http://127.0.0.1:3000";
  const url = `${base}/api/efro/products?shop=demo&debug=1`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error(`[guard-mojibake] HTTP ${res.status} ${res.statusText} for ${url}`);
    process.exit(2);
  }

  const data = await res.json();
  const hits = [];
  scanValue("response", data, hits);

  if (hits.length > 0) {
    console.error(`\n[guard-mojibake] FOUND ${hits.length} mojibake hit(s) in API response:`);
    for (const h of hits.slice(0, 25)) {
      console.error(`- ${h.path}: ${JSON.stringify(h.value)}`);
    }
    if (hits.length > 25) console.error(`... and ${hits.length - 25} more`);
    console.error("\nFix: DB sanitize/repair must make this go to ZERO.\n");
    process.exit(1);
  }

  console.log("[guard-mojibake] OK – no mojibake detected.");
}

main().catch((e) => {
  console.error("[guard-mojibake] unexpected error", e);
  process.exit(2);
});
