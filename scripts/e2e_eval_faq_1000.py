import json, re

def norm(s: str) -> str:
  return re.sub(r"\s+", " ", (s or "").lower()).strip()

faq = json.load(open("scripts/fixtures/shop.faq.json", "r", encoding="utf-8"))
conv = json.load(open("scripts/fixtures/conversations1000.json", "r", encoding="utf-8"))
products = json.load(open("scripts/fixtures/supabase.products100.json", "r", encoding="utf-8"))

topics = faq.get("topics", [])

# categories from catalog (helps detect "ich brauche kosmetik/sport/..." product intent)
cats = set()
for p in products:
  c = norm(p.get("category",""))
  if c and c != "(none)":
    cats.add(c)

FAQ_STRONG = [
  "lieferzeit","versanddauer","retoure","rückgabe","widerruf","paypal","klarna","kreditkarte",
  "tracking","sendungsnummer","zugestellt","kundenservice","kontakt","garantie","agb","datenschutz",
  "rechnung","mwst","ust","vat","steuer"
]

def looks_product_intent(text: str) -> bool:
  t = norm(text)

  # hard product signals
  if "€" in t or " eur" in t:
    return True
  if re.search(r"\b\d+\b", t) and any(w in t for w in ["unter", "bis", "max", "budget"]):
    return True

  # typical product request phrasing
  if any(w in t for w in ["empfiehl", "empfehl", "was passt", "ich brauche", "ich suche", "kannst du mir empfehlen"]):
    # if category mentioned => almost certainly product flow
    if any(c in t for c in cats):
      return True

  return False

def has_strong_faq_signal(text: str) -> bool:
  t = norm(text)
  return any(s in t for s in FAQ_STRONG)

def match_faq(text: str):
  t = norm(text)
  # gate: if product intent and no strong faq signal => do not route to faq
  if looks_product_intent(t) and not has_strong_faq_signal(t):
    return None

  best = None
  for topic in topics:
    kws = [norm(k) for k in topic.get("keywords", []) if norm(k)]
    hit = sum(1 for kw in kws if kw and kw in t)
    # require at least 1 hit; score is hit-density
    score = hit / max(3, min(10, len(kws) or 1))
    if hit > 0 and (best is None or score > best[1]):
      best = (topic.get("id"), score, hit)
  return best

THRESH = 0.10

faq_items = [x for x in conv if x.get("kind")=="faq"]
prod_items = [x for x in conv if x.get("kind")=="product"]

faq_hit=0; faq_miss=0; wrong_topic=0
prod_false=0

samples_miss=[]; samples_wrong=[]; samples_false=[]

for x in faq_items:
  q = x["turns"][0]["text"]
  exp = (x.get("expected") or {}).get("faq_topic_id")
  m = match_faq(q)
  ok = bool(m and m[1] >= THRESH)
  if not ok:
    faq_miss += 1
    if len(samples_miss)<5: samples_miss.append(q)
    continue
  if exp and m[0] != exp:
    wrong_topic += 1
    if len(samples_wrong)<5: samples_wrong.append((q, exp, m[0], m[1]))
  else:
    faq_hit += 1

for x in prod_items:
  q = x["turns"][0]["text"]
  m = match_faq(q)
  if m and m[1] >= THRESH:
    prod_false += 1
    if len(samples_false)<5: samples_false.append((q, m[0], m[1]))

print("THRESH", THRESH)
print("faq_total", len(faq_items), "hit", faq_hit, "miss", faq_miss, "wrong_topic", wrong_topic)
print("prod_total", len(prod_items), "faq_false_positive", prod_false)
if samples_miss: print("miss_samples:", samples_miss)
if samples_wrong: print("wrong_samples:", samples_wrong)
if samples_false: print("false_samples:", samples_false)
