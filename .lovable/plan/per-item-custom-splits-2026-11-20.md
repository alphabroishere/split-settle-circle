# Per-item custom splits

## Goal
Add equal or custom allocations to each bill item while preserving the existing itemized bill workflow and appearance.

## Work
- Extend the item and draft data to store optional member allocations in paise, with existing saved bills defaulting to equal splits.
- Add an item-level Equal/Custom selector, editable member amounts, and allocated/remaining feedback using the current styling.
- Apply item allocations in shared split calculations and block saving unless every custom item allocates its exact total; keep taxes and discounts reconciling as before.
- Add focused tests for equal and unequal items, multiple items, decimal amounts, invalid allocations, and resulting balances/settlements.

## Validation
Run the bill-split and calculation tests, check the preview flow from saving a custom itemized expense through balances and settlement suggestions, and confirm scanning and existing expense modes remain available.
