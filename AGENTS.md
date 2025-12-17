EFRO SellerBrain – Working rules
- Minimal invasive changes
- Fix ONLY these failing scenarios: S2v2, S4v2, S5v1, S5v6, F6v2
- Keep board ambiguity rule: "board" alone => ASK_CLARIFICATION + AMBIGUOUS_BOARD
- Cheapest snowboard without explicit price must cap <= 700 (test expectation)
- Premium/über X must not filter out all products
- Always run: pnpm sellerbrain:scenarios and show the failing sections
