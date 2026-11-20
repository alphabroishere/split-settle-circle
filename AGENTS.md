<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- SplitMate has no auth or database yet: state lives in a React reducer (`src/lib/splitmate/store.tsx`) persisted to localStorage and seeded from `sample-data.ts`. The only server code is the bill-photo reader (`bill-scan.functions.ts`, Lovable AI Gateway), which returns extracted rows and never stores data.
- Money is stored as integer paise everywhere; convert only at input/display (`toPaise`, `formatINR`) to avoid float drift.
- Pure money logic (splits, item-wise bill splits, balances, minimum-transaction settlement, UPI links) lives in `src/lib/splitmate/calc.ts` with tests in `calc.test.ts` / `bill-split.test.ts`; keep UI free of calculation logic.
- Itemized expenses reuse the normal `Expense` (splitType `unequal`, final `shares`) plus an optional `bill` snapshot; optional item `customShares` stores per-member paise, while legacy items remain equal splits.
- Settlement pairs exact opposite balances first (never loses optimality), then runs the exact bitmask search; greedy is only a fallback above `EXACT_LIMIT` unpaired people. Tests compare against brute force.
- UPI links are built by hand, not with URLSearchParams: values use %20 (some UPI apps show "+" literally), "@" stays literal, and names/notes are stripped of emoji/symbols.
