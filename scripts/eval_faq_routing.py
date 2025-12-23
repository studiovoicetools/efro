import json, re

def norm(s: str) -> str:
  return re.sub(r"\s+", " ", (s or "").lower()).strip()

faq = json.load(open("scripts/fixtures/shop.faq.json", "r", encoding="utf-8"))
conv = json.load(open("scripts/fixtures/conversations500.json", "r", encoding="utf-8"))

topics = faq.get("topics", [])

def match_faq(text: str):
  t = norm(text)
  best = None
  for topic in topics:
    kws = [norm(k) for k in topic.get("keywords", []) if norm(k)]
    hit = 0
    for kw in kws:
      if kw and kw in t:
        hit += 1
    score = hit / max(3, min(10, len(kws) or 1))
    if hit > 0 and (best is None or score > best[1]):
      best = (topic.get("id"), score)
  return best

THRESH = 0.10

faq_total = sum(1 for x in conv if x.get("kind")=="faq")
prod_total = sum(1 for x in conv if x.get("kind")=="product")

faq_hit = 0
faq_miss = 0
prod_false = 0

for x in conv:
  text = x["turns"][0]["text"]
  m = match_faq(text)
  is_hit = bool(m and m[1] >= THRESH)
  if x.get("kind") == "faq":
    faq_hit += 1 if is_hit else 0
    faq_miss += 0 if is_hit else 1
  else:
    prod_false += 1 if is_hit else 0

print("THRESH", THRESH)
print("faq_hit", faq_hit, "/", faq_total)
print("faq_miss", faq_miss, "/", faq_total)
print("prod_false_positive", prod_false, "/", prod_total)
