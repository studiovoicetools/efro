# Gate 1 – Suggest: Products via Repo only (no self-fetch)

## Change
- `/api/efro/suggest` loads products **only via repo/Supabase** (`getProductsForShop`) and **does not call any internal HTTP endpoints** (no `fetch()` to `/api/efro/products` or `debug-products`).
- `source` returned from repo is tagged as `supabase_${source}`.

## Proof (commands)
- No self-fetch patterns:
  - `rg -n "fetch\\(|debug-products|/api/efro/products|localhost:3000/api/efro/products" src/app/api/efro/suggest/route.ts -S`
- Runtime check:
  - `curl -sS "https://app.avatarsalespro.com/api/efro/suggest?shop=avatarsalespro-dev.myshopify.com&text=zeige%20mir%20parfum" | python3 -m json.tool`
  - `curl -sS "https://app.avatarsalespro.com/api/efro/suggest?shop=demo&text=zeige%20mir%20parfum" | python3 -m json.tool`

## Commit
- `gate1: suggest loads products via repo only (no self-fetch) + source tag`
