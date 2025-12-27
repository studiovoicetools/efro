export type PolicyViolation = {
  productId: string;
  reason: string;
};

export function checkPolicyViolations(products: any[]): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const product of products) {
    const title = product?.title?.toLowerCase() || "";
    const desc = product?.description?.toLowerCase() || "";

    // Beispielregel: keine Produkte mit "Waffe" im Titel oder Beschreibung
    if (title.includes("waffe") || desc.includes("waffe")) {
      violations.push({
        productId: product?.id || "unknown",
        reason: 'Verbotenes Stichwort: "Waffe"',
      });
    }

    // Beispielregel: kein Alkohol ohne Alterskennzeichnung
    if ((title.includes("wein") || desc.includes("bier")) && !product?.ageRestriction) {
      violations.push({
        productId: product?.id || "unknown",
        reason: "Alkohol ohne Altersfreigabe",
      });
    }
  }

  return violations;
}
