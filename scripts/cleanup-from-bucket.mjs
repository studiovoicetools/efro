import fs from "node:fs";
import path from "node:path";

const bucketFile = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!bucketFile) {
  console.error("Usage: node scripts/cleanup-from-bucket.mjs docs/CLEANUP_BUCKET_A_SAFE_DELETE.txt [--dry-run]");
  process.exit(1);
}

const raw = fs.readFileSync(bucketFile, "utf8");

// normalize newlines + kill NUL bytes (falls Datei komisch encodiert ist)
const lines = raw
  .replace(/\r\n/g, "\n")
  .replace(/\u0000/g, "")
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean);

function extractRepoPath(line) {
  // normalize slashes
  const s = line.replace(/\\/g, "/");

  // find last "src/... | docs/... | scripts/..." at line end
  const m = s.match(/(src|docs|scripts)\/.+$/);
  return m ? m[0] : null;
}

let ok = 0, missing = 0, failed = 0, skipped = 0;

for (const line of lines) {
  const rel = extractRepoPath(line);
  if (!rel) {
    console.warn("[skip] cannot parse:", line);
    skipped++;
    continue;
  }

  const p = path.resolve(process.cwd(), rel);

  if (!fs.existsSync(p)) {
    console.warn("[missing]", rel);
    missing++;
    continue;
  }

  if (dryRun) {
    console.log("[dry-run] would delete:", rel);
    ok++;
    continue;
  }

  try {
    fs.rmSync(p, { force: true, recursive: true });
    console.log("[deleted]", rel);
    ok++;
  } catch (e) {
    console.error("[failed]", rel, e?.message || e);
    failed++;
  }
}

console.log("");
console.log("Done.");
console.log("deleted(or would delete):", ok);
console.log("missing:", missing);
console.log("failed:", failed);
console.log("skipped:", skipped);

if (failed > 0) process.exit(2);
