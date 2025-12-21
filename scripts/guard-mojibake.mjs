// scripts/guard-mojibake.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const MOJIBAKE_RE = new RegExp(
  [
    "\\u00C3[\\u0080-\\u00BF]",                 // "Ã" + UTF-8 continuation byte
    "\\u00C2[\\u0080-\\u00BF]",                 // "a" + UTF-8 continuation byte
    "\\u00E2\\u20AC[\\u2018\\u2019\\u201C\\u201D\\u0153\\u00A6\\u00A2\\u2013\\u2014]", // "UTF8-mojibake cluster" cluster
    "\\u00E2\\u201E\\u00A2",                    // "UTF8-mojibake TM"
    "\\u00EF\\u00BF\\u00BD",                    // "ï¿½"
    "\\uFFFD"                                   // Unicode replacement char
  ].join("|")
);

// Wichtig: der Guard enthÃ¤lt absichtlich Mojibake-Patterns (Regex) und wÃ¼rde sich sonst selbst triggern.
const IGNORE_STAGED_FILES = new Set([
  "scripts/guard-mojibake.mjs",
  ".githooks/pre-commit",
]);

function isProbablyBinary(buf) {
  // Null-Bytes => sehr wahrscheinlich binÃ¤r
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function scanText(filePath, text, hits) {
  if (!text) return;
  if (MOJIBAKE_RE.test(text)) {
    const idx = text.search(MOJIBAKE_RE);
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + 120);
    hits.push({
      file: filePath,
      snippet: text.slice(start, end),
    });
  }
}

function getStagedFiles() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
  })
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !IGNORE_STAGED_FILES.has(p));

  return out;
}

function readFileSafe(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (isProbablyBinary(buf)) return { ok: true, skipped: true, reason: "binary" };
    const text = buf.toString("utf8");
    return { ok: true, skipped: false, text };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function main() {
  const files = getStagedFiles();

  if (files.length === 0) {
    console.log("[guard-mojibake] OK - no staged files to scan (after ignore list).");
    return;
  }

  const hits = [];
  const missing = [];

  for (const rel of files) {
    const filePath = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(filePath)) {
      missing.push(rel);
      continue;
    }

    const r = readFileSafe(filePath);
    if (!r.ok) {
      console.error(`[guard-mojibake] ERROR reading: ${rel}`);
      console.error(r.error);
      process.exit(2);
    }

    if (r.skipped) continue;
    scanText(rel, r.text, hits);
  }

  if (missing.length > 0) {
    console.warn("[guard-mojibake] WARNING: staged paths not found (maybe deleted/renamed):", missing);
  }

  if (hits.length > 0) {
    console.error(`\n[guard-mojibake] FOUND ${hits.length} mojibake hit(s) in staged files:`);
    for (const h of hits.slice(0, 25)) {
      console.error(`- ${h.file}: ${JSON.stringify(h.snippet)}`);
    }
    if (hits.length > 25) console.error(`... and ${hits.length - 25} more`);
    console.error("\nFix: Datei-Encoding/Text reparieren (UTF-8) bis das 0 ist.\n");
    process.exit(1);
  }

  console.log("[guard-mojibake] OK - no mojibake detected.");
}

main().catch((e) => {
  console.error("[guard-mojibake] unexpected error", e);
  process.exit(2);
});

