import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/fix-docs.mjs docs/OPS_RUNBOOK.md");
  process.exit(1);
}

let t = fs.readFileSync(file, "utf8");

// normalize newlines
t = t.replace(/\r\n/g, "\n");

// remove accidental duplicate separators
t = t.replace(/\n---\n---\n/g, "\n---\n");

// fix known mojibake dash
t = t.replace(/â€”/g, "—");

// neutralize the example line so docs don't contain mojibake bytes themselves
t = t.replace(
  /- In API-Responses gab es Mojibake-Zeichen \(z\. B\..*\)\./m,
  "- In API-Responses gab es Mojibake-Zeichen (z. B. <MOJIBAKE_BYTES>, <CTRL_CHARS>)."
);

fs.writeFileSync(file, t, "utf8");
console.log("OK fixed:", file);
