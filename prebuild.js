#!/usr/bin/env node
/**
 * 🌍 Cross-Platform Prebuild Script for EFRO
 * Läuft automatisch auf Windows (PowerShell) und Linux (bash)
 */

import { execSync } from "child_process";
import { existsSync } from "fs";

const isWindows = process.platform === "win32";

function run(command) {
  console.log(`\n🛠️  Running: ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (err) {
    console.error(`❌ Fehler bei: ${command}`);
    process.exit(1);
  }
}

// --- Client Hook Check ---
if (isWindows && existsSync("./check-client-hooks.ps1")) {
  run(`powershell -ExecutionPolicy Bypass -File ./check-client-hooks.ps1`);
} else if (existsSync("./check-client-hooks.sh")) {
  run(`bash ./check-client-hooks.sh`);
} else {
  console.warn("⚠️ Keine check-client-hooks-Datei gefunden.");
}

// --- Supabase SSR Check ---
if (isWindows && existsSync("./check-supabase-ssr.ps1")) {
  run(`powershell -ExecutionPolicy Bypass -File ./check-supabase-ssr.ps1`);
} else if (existsSync("./check-supabase-ssr.sh")) {
  run(`bash ./check-supabase-ssr.sh`);
} else {
  console.warn("⚠️ Keine check-supabase-ssr-Datei gefunden.");
}

console.log("\n✅ Prebuild erfolgreich abgeschlossen!");
