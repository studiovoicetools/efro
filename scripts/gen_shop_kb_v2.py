import json
from pathlib import Path

OUT_KB = Path("scripts/fixtures/shop.kb.json")
OUT_FAQ = Path("scripts/fixtures/shop.faq.json")

kb = {
  "version": 2,
  "language": "de",
  "store": {
    "name": "Demo-Shop",
    "currency": "EUR",
    "countries": ["DE","AT","CH"],
    "channels": ["web"],
    "hours": {"support_hours": "Mo-Fr 09:00-17:00"},
  },
  "shipping": {
    "carriers": ["DHL","DPD"],
    "processing_time": "1-2 Werktage",
    "delivery_time": "2-5 Werktage",
    "tracking": True,
    "shipping_costs": "ab 4,90€ (kostenfrei ab 59€)",
    "international": "DACH",
    "keywords": ["versand","lieferung","lieferzeit","zustellung","sendung","paket","tracking","sendungsverfolgung","dhl","dpd","ab wann","wo ist"],
  },
  "returns": {
    "return_window_days": 30,
    "condition": "unbenutzt/ungeöffnet, Originalverpackung wenn möglich",
    "refund_time": "3-7 Werktage nach Eingang",
    "exchange": True,
    "keywords": ["retoure","rückgabe","umtausch","widerruf","zurückschicken","rücksende","erstattung","geld zurück"],
  },
  "payments": {
    "methods": ["PayPal","Kreditkarte","Klarna","Apple Pay"],
    "invoice": True,
    "keywords": ["zahlung","zahlungsarten","bezahlen","paypal","kreditkarte","klarna","apple pay","rechnung","raten"],
  },
  "orders": {
    "status_flow": ["bestellt","bezahlt","gepackt","versendet","zugestellt"],
    "change_address": "nur solange nicht versendet",
    "cancel": "nur solange nicht versendet",
    "keywords": ["bestellung","order","stornieren","adresse ändern","lieferadresse","status","wann kommt","wo ist meine bestellung","bestellnummer"],
  },
  "promos": {
    "coupon_rules": "1 Code pro Bestellung; nicht kombinierbar",
    "giftcards": True,
    "keywords": ["gutschein","rabatt","coupon","code","aktion","giftcard","geschenkgutschein","funktioniert nicht"],
  },
  "warranty": {
    "warranty_months": 24,
    "defect_handling": "Foto/Video senden, dann Austausch/Erstattung",
    "keywords": ["garantie","gewährleistung","defekt","kaputt","reklamation","transportschaden","austausch","ersatz"],
  },
  "policies": {
    "privacy": "DSGVO-konform (Demo-Text)",
    "terms": "AGB (Demo-Text)",
    "keywords": ["datenschutz","dsgvo","agb","impressum","cookies","rechtliches"],
  },
  "support": {
    "contact": ["E-Mail","Kontaktformular"],
    "sla": "Antwort in 24-48h",
    "keywords": ["kontakt","support","hilfe","kundenservice","erreichbar","telefon","mail","beschwerde"],
  },
  "product_help": {
    "sizing": "siehe Größentabelle / Produktbeschreibung",
    "care": "Pflegehinweise in Beschreibung",
    "compatibility": "Kompatibilität in Specs",
    "keywords": ["größe","passt","größentabelle","material","pflege","kompatibel","anleitung","bedienung","inhalt","maße","gewicht"],
  },
  "tax_invoices": {
    "vat": "Preise inkl. MwSt.",
    "invoice": "Rechnung per E-Mail nach Versand",
    "keywords": ["mwst","ust","rechnung","firma","b2b","steuernummer","vat","beleg"],
  },
}

# FAQ Topics (Routing-Ziele) – id muss stabil bleiben
topics = [
  {"id":"shipping_time","title":"Versand & Lieferzeit","keywords":kb["shipping"]["keywords"],"answer":"Wir versenden i.d.R. in 1–2 Werktagen. Lieferzeit meist 2–5 Werktage. Tracking vorhanden."},
  {"id":"returns","title":"Retoure & Rückgabe","keywords":kb["returns"]["keywords"],"answer":"Du kannst innerhalb von 30 Tagen retournieren. Erstattung 3–7 Werktage nach Eingang."},
  {"id":"payments","title":"Zahlungsarten","keywords":kb["payments"]["keywords"],"answer":"Wir akzeptieren PayPal, Kreditkarte, Klarna und Apple Pay. Rechnung ist möglich."},
  {"id":"order_status","title":"Bestellung, Status, Storno, Adresse","keywords":kb["orders"]["keywords"],"answer":"Status: bestellt→bezahlt→gepackt→versendet→zugestellt. Änderungen/Storno nur vor Versand."},
  {"id":"promos","title":"Gutscheine & Aktionen","keywords":kb["promos"]["keywords"],"answer":"1 Code pro Bestellung, nicht kombinierbar. Giftcards sind möglich. Wenn ein Code nicht klappt: Bedingungen prüfen."},
  {"id":"support","title":"Support & Kontakt","keywords":kb["support"]["keywords"],"answer":"Kontakt per E-Mail/Kontaktformular. Antwort meist in 24–48h."},
  {"id":"warranty","title":"Garantie, Defekt, Reklamation","keywords":kb["warranty"]["keywords"],"answer":"24 Monate Gewährleistung. Bei Defekt bitte Foto/Video senden, dann Austausch/Erstattung."},
  {"id":"legal","title":"Rechtliches (DSGVO/AGB)","keywords":kb["policies"]["keywords"],"answer":"Datenschutz/AGB/Impressum findest du im Footer. (Demo-Text)"},
  {"id":"product_help","title":"Produktinfos (Größe/Pflege/Kompatibilität)","keywords":kb["product_help"]["keywords"],"answer":"Größe/Pflege/Kompatibilität stehen in der Produktbeschreibung und Specs."},
  {"id":"tax_invoice","title":"MwSt & Rechnungen","keywords":kb["tax_invoices"]["keywords"],"answer":"Preise inkl. MwSt. Rechnung kommt per E-Mail nach Versand."},
]

OUT_KB.parent.mkdir(parents=True, exist_ok=True)
OUT_KB.write_text(json.dumps(kb, ensure_ascii=False, indent=2), encoding="utf-8")
OUT_FAQ.write_text(json.dumps({"version":2,"language":"de","topics":topics}, ensure_ascii=False, indent=2), encoding="utf-8")

print("wrote", OUT_KB.as_posix())
print("wrote", OUT_FAQ.as_posix(), "topics=", len(topics))
