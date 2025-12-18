// src/data/debugProducts.scenarios.ts
import productsScenarios from "../../scripts/fixtures/products.scenarios.json";

// Unterstützt beide Formen:
// A) { "products": [...] }
// B) [ ... ]
const products =
  (productsScenarios as any)?.products ?? (productsScenarios as any) ?? [];

export const debugProductsScenarios = products;
export default debugProductsScenarios;
