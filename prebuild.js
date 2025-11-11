#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";

console.log("🚀 EFRO Auto-Prebuild gestartet ...");

// --------------------------------------------------
// 1️⃣ SDK prüfen
// --------------------------------------------------
if (fs.existsSync("./mascotbot-sdk-react-0.1.6.tgz")) {
  console.log("✅ mascotbot-sdk-react-0.1.6.tgz gefunden – kopiere nach ./src/");
  if (!fs.existsSync("./src")) fs.mkdirSync("./src");
  fs.copyFileSync("./mascotbot-sdk-react-0.1.6.tgz", "./src/mascotbot-sdk-react-0.1.6.tgz");
} else {
  console.warn("⚠️ WARNUNG: mascotbot-sdk-react-0.1.6.tgz fehlt!");
}

// --------------------------------------------------
// 2️⃣ Tailwind prüfen
// --------------------------------------------------
console.log("🧠 Prüfe Tailwind-Version …");
let tailwindVersion = "";
try {
  tailwindVersion = execSync("npm list tailwindcss --depth=0")
    .toString()
    .match(/tailwindcss@([\d.]+)/)?.[1] || "none";
} catch {
  tailwindVersion = "none";
}
console.log("📦 Aktuelle Tailwind-Version:", tailwindVersion);

if (tailwindVersion.startsWith("4")) {
  console.log("🚨 Tailwind v4 erkannt – downgrade auf 3.4.18 …");
  execSync("npm uninstall -D @tailwindcss/postcss || true", { stdio: "inherit" });
  execSync("npm uninstall -D tailwindcss || true", { stdio: "inherit" });
  execSync("npm install -D tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20", {
    stdio: "inherit",
  });
} else if (tailwindVersion === "none") {
  console.log("📦 Installiere Tailwind v3.4.18 …");
  execSync("npm install -D tailwindcss@3.4.18 postcss@8.4.41 autoprefixer@10.4.20", {
    stdio: "inherit",
  });
} else {
  console.log("✅ Tailwind v3 ist aktiv");
}

// --------------------------------------------------
// 3️⃣ PostCSS config sicherstellen
// --------------------------------------------------
const postcssConfig = `// postcss.config.cjs – kompatibel mit Next.js 14 + Tailwind v3
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
fs.writeFileSync("postcss.config.cjs", postcssConfig);
console.log("🧩 postcss.config.cjs aktualisiert.");

// --------------------------------------------------
// 4️⃣ TypeScript prüfen
// --------------------------------------------------
try {
  execSync("npx tsc -v", { stdio: "ignore" });
  console.log("✅ TypeScript vorhanden");
} catch {
  console.log("🧠 Installiere TypeScript-Abhängigkeiten …");
  execSync("npm install -D typescript @types/node @types/react @types/react-dom", {
    stdio: "inherit",
  });
}

// --------------------------------------------------
// 5️⃣ Supabase SSR prüfen
// --------------------------------------------------
try {
  execSync("npm list @supabase/ssr", { stdio: "ignore" });
  console.log("✅ @supabase/ssr bereits vorhanden");
} catch {
  console.log("🧩 Installiere fehlendes @supabase/ssr …");
  execSync("npm install @supabase/ssr", { stdio: "inherit" });
}

// --------------------------------------------------
// 6️⃣ Final Check
// --------------------------------------------------
console.log("----------------------------");
console.log("✅ Final Check:");
try {
  console.log("   - Tailwind-Version:", execSync("npx tailwindcss -v").toString().trim());
} catch {
  console.log("   - Tailwind-Version: nicht gefunden");
}
try {
  console.log("   - TypeScript:", execSync("npx tsc -v").toString().trim());
} catch {
  console.log("   - TypeScript: nicht gefunden");
}
try {
  console.log("   - Supabase SSR:", execSync("npm list @supabase/ssr --depth=0").toString().trim());
} catch {
  console.log("   - Supabase SSR: nicht installiert");
}
console.log("----------------------------");

console.log("✅ Prebuild erfolgreich abgeschlossen!");
