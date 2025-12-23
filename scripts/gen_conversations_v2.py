import json, random, re
from pathlib import Path

random.seed(7)

products = json.load(open("scripts/fixtures/supabase.products100.json","r",encoding="utf-8"))
faq = json.load(open("scripts/fixtures/shop.faq.json","r",encoding="utf-8"))
kb  = json.load(open("scripts/fixtures/shop.kb.json","r",encoding="utf-8"))

OUT = Path("scripts/fixtures/conversations1000.json")

def clean(s): return re.sub(r"\s+"," ",(s or "").strip())
def pick(xs): return random.choice(xs)

titles = [clean(p.get("title","")) for p in products if clean(p.get("title",""))]
titles = [t for t in titles if t]
random.shuffle(titles)

# quick index for cross/upsell
by_title = {clean(p.get("title","")): p for p in products}
def get_links(p):
  return (p.get("cross_sell_skus") or []), (p.get("upsell_skus") or [])

faq_templates = [
  ("shipping_time", ["Wie lange ist die Lieferzeit?","Wann kommt meine Lieferung?","Wie schnell liefert ihr?"]),
  ("returns", ["Wie funktioniert die Retoure?","Kann ich umtauschen?","Wie lange kann ich zurückgeben?"]),
  ("payments", ["Welche Zahlungsarten gibt es?","Kann ich mit PayPal zahlen?","Geht Klarna?"]),
  ("order_status", ["Kann ich meine Bestellung stornieren?","Kann ich die Lieferadresse ändern?","Wo ist meine Bestellung?"]),
  ("promos", ["Mein Gutscheincode geht nicht – warum?","Habt ihr Geschenkgutscheine?","Kann man Codes kombinieren?"]),
  ("warranty", ["Mein Artikel ist defekt – was nun?","Transportschaden: wie läuft das?","Gibt es Garantie?"]),
  ("tax_invoice", ["Sind Preise inkl. MwSt.?","Kann ich eine Rechnung bekommen?","Rechnung für Firma möglich?"]),
  ("product_help", ["Wie fallen die Größen aus?","Gibt es Pflegehinweise?","Ist das kompatibel mit X?"]),
]

product_templates = [
  "Ich suche {cat} unter {budget}€ – was empfiehlst du?",
  "Zeig mir bitte etwas in {cat} für {budget}€.",
  "Was ist das beste Preis/Leistung in {cat} bis {budget}€?",
  "Ich brauche {cat} – eher günstig. Was passt?",
]

cats = [clean(p.get("category","")) for p in products if clean(p.get("category",""))]
cats = sorted(set([c for c in cats if c]))

budgets = [20,30,40,50,60,80,100,150,200,300]

def make_faq_item():
  tid, qs = pick(faq_templates)
  q = pick(qs)
  return {"kind":"faq","expected":{"faq_topic_id":tid},"turns":[{"role":"user","text":q}]}

def make_order_like():
  qs = [
    "Ich habe bestellt, aber keine Bestellbestätigung bekommen.",
    "Kann ich die Adresse noch ändern? Bestellung ist von heute.",
    "Ich möchte stornieren – geht das noch?",
    "Wo finde ich die Sendungsnummer?",
    "Mein Paket ist laut Tracking zugestellt, aber nicht da."
  ]
  return {"kind":"faq","expected":{"faq_topic_id":"order_status"},"turns":[{"role":"user","text":pick(qs)}]}

def make_product_item():
  cat = pick(cats) if cats else "kosmetik"
  budget = pick(budgets)
  q = pick(product_templates).format(cat=cat, budget=budget)
  # 2-turn: follow-up for cross/upsell intent
  follow = pick([
    "Hast du etwas Passendes als Upgrade?",
    "Gibt es ein Zubehör, das dazu passt?",
    "Was würdest du dazu noch empfehlen?",
    "Gibt es eine günstigere Alternative?"
  ])
  return {"kind":"product","expected":{"category":cat,"budget":budget},"turns":[{"role":"user","text":q},{"role":"user","text":follow}]}

items=[]
# 450 FAQ (inkl. order-like), 550 Product (2-turn)
for _ in range(350):
  items.append(make_faq_item())
for _ in range(100):
  items.append(make_order_like())
for _ in range(550):
  items.append(make_product_item())

random.shuffle(items)
OUT.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", OUT.as_posix(), "items=", len(items))
