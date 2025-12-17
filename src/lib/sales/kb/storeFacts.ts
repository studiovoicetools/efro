export type StoreFacts = {
  shopName?: string;

  shipping?: {
    carriers?: string[];
    regions?: string[];        // z. B. ["DE", "AT", "CH"]
    deliveryTimeHint?: string; // freier Text
    costsHint?: string;        // freier Text
    freeShippingThresholdEur?: number | null;
  };

  returns?: {
    returnWindowDays?: number | null; // z. B. 14, 30
    conditionsHint?: string;          // freier Text
    processHint?: string;             // freier Text
  };

  warranty?: {
    warrantyHint?: string; // freier Text (Garantie/Gewährleistung)
  };

  payment?: {
    methods?: string[]; // z. B. ["PayPal", "Kreditkarte", "Klarna"]
  };

  support?: {
    email?: string;
    phone?: string;
    hoursHint?: string; // z. B. "Mo–Fr 9–17 Uhr"
    responseTimeHint?: string;
  };

  pickup?: {
    available?: boolean;
    locationHint?: string;
    hoursHint?: string;
  };

  faq?: Array<{
    id: string;
    question: string;
    answer: string;
    tags?: string[]; // z. B. ["shipping", "returns", "sizes"]
  }>;
};

/**
 * Safe Default: darf niemals undefined sein.
 * (Noch nicht verdrahtet. Nächster Schritt: Router/Trigger, der KB nutzt.)
 */
export const DEFAULT_STORE_FACTS: StoreFacts = {
  shipping: { freeShippingThresholdEur: null },
  returns: { returnWindowDays: null },
  pickup: { available: false },
  faq: [],
};
