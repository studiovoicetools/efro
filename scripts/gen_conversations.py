import json, random, re
from pathlib import Path

random.seed(7)

products_path = Path("scripts/fixtures/supabase.products100.json")
faq_path = Path("scripts/fixtures/shop.faq.json")
out_path = Path("scripts/fixtures/conversations500.json")

products = json.load(products_path.open("r", encoding="utf-8"))
faq = json.load(faq_path.open("r", encoding="utf-8"))

def clean(s: str) -> str:
  return re.sub(r"\s+", " ", (s or "").strip())

titles = [clean(p.get("title","")) for p in products if p.get("title")]
titles = [t for t in titles if t]
random.shuffle(titles)

# Simple category buckets (some products have category missing)
cats = {}
for p in products:
  cat = clean(p.get("category","(none)")) or "(none)"
  cats.setdefault(cat, []).append(clean(p.get("title","")))

faq_topics = faq.get("topics", [])

faq_q_templates = [
  "Wie lange ist die Lieferzeit?",
  "Wie funktioniert die Retoure?",
  "Welche Zahlungsarten gibt es?",
  "Kann ich per PayPal bezahlen?",
  "Wie erreiche ich den Support?",
  "Kann ich einen Artikel umtauschen?"
]

# Product question templates (intents + budget + cross/upsell)
prod_q_templates = [
  "Hast du {title}?",
  "Was kostet {title}?",
  "Ich suche etwas ähnliches wie {title}. Was empfiehlst du?",
  "Gibt es eine günstigere Alternative zu {title} unter {budget}€?",
  "Was passt gut als Ergänzung zu {title}?",
  "Ich will etwas wie {title} – aber besser für Einsteiger. Was ist passend?"
]

budgets = [20, 30, 50, 60, 80, 100, 150, 200, 300]

items = []
idx = 1

# 1) FAQ items (about 160)
for _ in range(160):
  t = random.choice(faq_q_templates)
  items.append({
    "id": f"Q{idx:04d}",
    "kind": "faq",
    "turns": [{"role":"user","text": t}]
  })
  idx += 1

# 2) Product items (about 340)
for _ in range(340):
  title = random.choice(titles)
  budget = random.choice(budgets)
  q = random.choice(prod_q_templates).format(title=title, budget=budget)
  items.append({
    "id": f"Q{idx:04d}",
    "kind": "product",
    "turns": [{"role":"user","text": q}]
  })
  idx += 1

# Shuffle + write
random.shuffle(items)
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", out_path.as_posix(), "items=", len(items))
