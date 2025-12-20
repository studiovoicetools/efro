import fs from "node:fs";

const file = process.argv[2] || "docs/TENANT_NORMALIZATION.md";
if (!fs.existsSync(file)) {
  console.error("ERROR: file not found:", file);
  process.exit(1);
}

let t = fs.readFileSync(file, "utf8");

// normalize newlines
t = t.replace(/\r\n/g, "\n");

// Fix wording + code formatting
t = t.replace(/Extern \(URLs\):\s*shop/g, "Extern (URLs): `shop`");
t = t.replace(/Intern \(Code\):\s*shopDomain \(normalized\)/g, "Intern (Code): `shopDomain` (normalized)");
t = t.replace(/DB:\s*shop_domain \(normalized\)/g, "DB: `shop_domain` (normalized)");

// Fix the missing 'n' typo and format as code
t = t.replace(
  /(^\s*)ormalizeShopDomain\(domain: string\): string \(zentral, wiederverwendet\)/m,
  "$1`normalizeShopDomain(domain: string): string` (zentral, wiederverwendet)"
);

// write back
fs.writeFileSync(file, t, "utf8");
console.log("OK fixed:", file);
