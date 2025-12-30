import { loadEnvLocalIfMissing } from "./_loadEnvLocal";
loadEnvLocalIfMissing(["SCENARIO_PRODUCTS_FIXTURE"]);
console.log("VAL=[" + (process.env.SCENARIO_PRODUCTS_FIXTURE ?? "") + "]");
