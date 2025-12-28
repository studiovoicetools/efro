// src/lib/sales/brain/steps/08_policy.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";
import { checkPolicyViolations } from "@/lib/sales/utils/checkPolicyViolations";

export async function runStep08_PolicyCheck(context: SellerBrainContext): Promise<void> {
  if (!context.recommendedProducts || context.recommendedProducts.length === 0) {
    return;
  }

  context.policyViolations = checkPolicyViolations(context.recommendedProducts);

  if (context.debugMode) {
    if (context.debug) {
      context.debug.push({
        step: "policy",
        policyViolations: context.policyViolations,
      });
    } else {
      context.debug = [
        {
          step: "policy",
          policyViolations: context.policyViolations,
        },
      ];
    }
  }
}
