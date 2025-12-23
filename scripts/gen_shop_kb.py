import json
from pathlib import Path

out = Path("scripts/fixtures")
out.mkdir(parents=True, exist_ok=True)

def write(name, obj):
  p = out / name
  p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
  print("wrote", p.as_posix())

shop_meta = {
  "version": 1,
  "language": "de",
  "currency": "EUR",
  "country": "DE",
  "shop_name": "Demo-Shop",
  "b2b_enabled": False,
  "tax_included_prices": True
}

shipping = {
  "version": 1,
  "standard_delivery_time": "2-4 Werktage",
  "processing_time": "0-1 Werktage",
  "shipping_costs": [
    {"zone":"DE", "cost_eur": 4.90, "free_from_eur": 49.00},
    {"zone":"AT", "cost_eur": 9.90, "free_from_eur": 99.00},
    {"zone":"EU", "cost_eur": 12.90, "free_from_eur": 129.00}
  ],
  "tracking": {"enabled": True, "carrier_examples": ["DHL", "DPD", "UPS"]},
  "express": {"enabled": False}
}

returns = {
  "version": 1,
  "withdrawal_days": 14,
  "return_shipping_paid_by": "customer",
  "refund_time": "3-7 Werktage nach Wareneingang",
  "exchange": {"enabled": True, "notes": "Umtausch über Rücksendung + Neubestellung."},
  "conditions": [
    "Unbenutzt und in Originalverpackung",
    "Hygieneartikel/Versiegelte Produkte ggf. ausgeschlossen, wenn geöffnet"
  ]
}

payments = {
  "version": 1,
  "methods": ["Kreditkarte", "PayPal", "Klarna", "Apple Pay", "Google Pay", "Vorkasse"],
  "invoice": {"enabled": False},
  "installments": {"enabled": False}
}

support = {
  "version": 1,
  "contact": {
    "email": "support@demo-shop.de",
    "phone": "",
    "chat": True
  },
  "hours": "Mo–Fr 09:00–17:00",
  "response_time": "innerhalb 24–48h (Werktage)"
}

promos = {
  "version": 1,
  "giftcards": True,
  "discount_codes": True,
  "newsletter": True
}

warranty = {
  "version": 1,
  "warranty_notes": [
    "Gesetzliche Gewährleistung gemäß EU-Recht",
    "Bei Defekt: bitte Foto/Video + Bestellnummer senden"
  ]
}

policies = {
  "version": 1,
  "privacy": "Wir verarbeiten personenbezogene Daten gemäß DSGVO.",
  "cookies": "Cookies für Shop-Funktion und optional Analytics.",
  "age_restriction": False
}

faq = {
  "version": 1,
  "language": "de",
  "topics": [
    {
      "id":"shipping_time",
      "title":"Lieferzeit",
      "keywords":["lieferzeit","wie lange dauert","versanddauer","wann kommt","zustellung","werktage"],
      "answer":"Die Lieferzeit beträgt in der Regel 2–4 Werktage (zzgl. 0–1 Werktag Bearbeitung)."
    },
    {
      "id":"shipping_costs",
      "title":"Versandkosten & Gratisversand",
      "keywords":["versandkosten","porto","gratisversand","kostenloser versand","free shipping"],
      "answer":"Versand DE 4,90€ (gratis ab 49€). AT 9,90€ (gratis ab 99€). EU 12,90€ (gratis ab 129€)."
    },
    {
      "id":"tracking",
      "title":"Tracking",
      "keywords":["tracking","sendungsverfolgung","paket verfolgen","nummer","sendungsnummer"],
      "answer":"Ja. Du erhältst nach Versand eine Sendungsnummer zur Sendungsverfolgung."
    },
    {
      "id":"returns",
      "title":"Retoure & Widerruf",
      "keywords":["retoure","rücksendung","widerruf","zurückschicken","rückgabe","umtausch"],
      "answer":"Du kannst innerhalb von 14 Tagen widerrufen. Rücksendekosten trägt in der Regel der Kunde. Erstattung 3–7 Werktage nach Wareneingang."
    },
    {
      "id":"payments",
      "title":"Zahlungsarten",
      "keywords":["zahlung","zahlungsarten","paypal","klarna","kreditkarte","apple pay","google pay","vorkasse"],
      "answer":"Wir akzeptieren Kreditkarte, PayPal, Klarna, Apple Pay, Google Pay und Vorkasse."
    },
    {
      "id":"support",
      "title":"Support",
      "keywords":["support","kontakt","erreichen","email","telefon","hilfe","kundenservice"],
      "answer":"Du erreichst uns per E-Mail (support@demo-shop.de). Antwortzeit: 24–48h an Werktagen. Servicezeiten: Mo–Fr 09:00–17:00."
    }
  ]
}

write("shop.meta.json", shop_meta)
write("shop.shipping.json", shipping)
write("shop.returns.json", returns)
write("shop.payments.json", payments)
write("shop.support.json", support)
write("shop.promos.json", promos)
write("shop.warranty.json", warranty)
write("shop.policies.json", policies)
write("shop.faq.json", faq)
