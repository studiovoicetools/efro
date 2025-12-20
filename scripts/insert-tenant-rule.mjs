import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/insert-tenant-rule.mjs docs/INTERFACES.md");
  process.exit(1);
}

let t = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

// Insert block
const insert = `
## Tenant-Key Regel (P0)
- External (URL Query): canonical key ist \`shop\`.
- Internal (Code): canonical variable ist \`shopDomain\`.
- Legacy: \`shopDomain\` als Query-Key ist erlaubt, aber nur als Übergang (nicht weiter ausbauen).
- Jede neue Route MUSS \`shop\` akzeptieren und intern nach \`shopDomain\` mappen (siehe docs/GLOSSARY.md).
`;

// Anchor: after the GLOSSARY reference line inside "Harte Regeln"
const anchorRe = /^- Tenant\/Shop Begriffe:.*GLOSSARY\.md\s*$/m;

if (!anchorRe.test(t)) {
  console.error("ERROR: anchor not found (Tenant/Shop Begriffe ... GLOSSARY.md).");
  process.exit(2);
}

// Only insert once
if (t.includes("## Tenant-Key Regel (P0)")) {
  console.log("OK: already present:", file);
  process.exit(0);
}

// Insert right after anchor line (plus one newline)
t = t.replace(anchorRe, (m) => `${m}\n${insert.trim()}\n`);

fs.writeFileSync(file, t, "utf8");
console.log("OK inserted tenant-key rule:", file);
