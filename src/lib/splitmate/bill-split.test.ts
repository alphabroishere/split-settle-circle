import { describe, expect, it } from "vitest";
import { allocateProportionally, computeBalances, computeItemizedSplit, minimizeTransactions, toPaise, validateItemizedBill } from "./calc";
import type { BillCharge, BillItem, Expense } from "./types";

const item = (total: number, memberIds: string[], name = "x"): BillItem => ({ id: name + total, name, quantity: 1, unitPrice: total, total, memberIds });
const customItem = (name: string, total: number, customShares: Record<string, number>): BillItem => ({
  id: name, name, quantity: 1, unitPrice: total, total, memberIds: Object.keys(customShares), splitMode: "custom", customShares,
});
const charge = (kind: BillCharge["kind"], amount: number, split: BillCharge["split"], memberIds: string[] = []): BillCharge => ({
  id: kind + amount, label: kind, kind, amount, split, memberIds,
});

describe("item-wise bill split", () => {
  it("divides a shared item equally between the people who had it", () => {
    const s = computeItemizedSplit({ items: [item(30000, ["a", "b"])], charges: [] });
    expect(s.shares).toEqual({ a: 15000, b: 15000 });
  });

  it("gives different items to different people", () => {
    const s = computeItemizedSplit({ items: [item(18000, ["a"]), item(22000, ["b"]), item(16000, ["a", "b"])], charges: [] });
    expect(s.shares).toEqual({ a: 26000, b: 30000 });
    expect(s.itemsTotal).toBe(56000);
  });

  it("splits tax in proportion to each person's items", () => {
    // a has ₹300, b has ₹100 → ₹40 tax splits 30 / 10
    const s = computeItemizedSplit({ items: [item(30000, ["a"]), item(10000, ["b"])], charges: [charge("tax", 4000, "proportional")] });
    expect(s.shares).toEqual({ a: 33000, b: 11000 });
  });

  it("splits delivery equally among everyone with items, not the whole group", () => {
    const s = computeItemizedSplit({ items: [item(30000, ["a"]), item(10000, ["b"])], charges: [charge("delivery", 4000, "equal")] });
    expect(s.shares).toEqual({ a: 32000, b: 12000 });
    expect(s.shares["c"]).toBeUndefined();
  });

  it("subtracts a discount", () => {
    const s = computeItemizedSplit({ items: [item(20000, ["a"]), item(20000, ["b"])], charges: [charge("discount", 5000, "equal")] });
    expect(s.total).toBe(35000);
    expect(s.shares).toEqual({ a: 17500, b: 17500 });
  });

  it("only charges the members a charge is assigned to", () => {
    const s = computeItemizedSplit({ items: [item(10000, ["a"]), item(10000, ["b"])], charges: [charge("tip", 3000, "equal", ["a"])] });
    expect(s.shares).toEqual({ a: 13000, b: 10000 });
  });

  it("shares always add up to the computed total", () => {
    const s = computeItemizedSplit({
      items: [item(9999, ["a", "b", "c"]), item(12345, ["b"])],
      charges: [charge("tax", 557, "proportional"), charge("delivery", 1001, "equal"), charge("discount", 333, "proportional")],
    });
    expect(Object.values(s.shares).reduce((x, y) => x + y, 0)).toBe(s.total);
  });

  it("proportional allocation adds up exactly", () => {
    const p = allocateProportionally(1000, { a: 1, b: 1, c: 1 });
    expect(Object.values(p).reduce((x, y) => x + y, 0)).toBe(1000);
  });
});

describe("bill reconciliation", () => {
  const bill = { items: [item(98000, ["a", "b"])], charges: [charge("tax", 4900, "proportional"), charge("discount", 5000, "equal")] };

  it("accepts a bill whose items and charges match the bill total", () => {
    expect(validateItemizedBill(bill, 97900)).toEqual([]);
  });

  it("reports how much is missing from the bill total", () => {
    expect(validateItemizedBill(bill, 99900)).toContain("Items and charges are ₹20 short of the bill total");
  });

  it("refuses an item nobody is assigned to", () => {
    const errs = validateItemizedBill({ items: [item(5000, [], "Naan")], charges: [] }, 5000);
    expect(errs).toContain("Naan isn't assigned to anyone");
  });
});

describe("per-item custom allocations", () => {
  it("keeps legacy items equally split and uses custom paise allocations for an item", () => {
    const split = computeItemizedSplit({
      items: [item(18000, ["a", "b"], "Equal item"), customItem("Custom item", 18000, { a: 12000, b: 6000 })],
      charges: [],
    });
    expect(split.shares).toEqual({ a: 21000, b: 15000 });
    expect(Object.values(split.shares).reduce((sum, amount) => sum + amount, 0)).toBe(split.total);
  });

  it("sums allocations across multiple items into ordinary balances and minimum settlements", () => {
    const bill = {
      items: [customItem("Shared dish", 18000, { a: 12000, b: 6000 }), item(6000, ["b", "c"], "Drink")],
      charges: [],
    };
    const split = computeItemizedSplit(bill);
    expect(split.shares).toEqual({ a: 12000, b: 9000, c: 3000 });

    const expense: Expense = {
      id: "bill", groupId: "g", description: "Dinner", amount: split.total, paidBy: "a", date: "2026-11-20",
      category: "food", splitType: "unequal", shares: split.shares, bill,
    };
    const balances = computeBalances(["a", "b", "c"], [expense]);
    expect(balances.map(({ memberId, net }) => [memberId, net])).toEqual([["a", 12000], ["b", -9000], ["c", -3000]]);
    expect(minimizeTransactions(balances)).toEqual([
      { from: "b", to: "a", amount: 9000 },
      { from: "c", to: "a", amount: 3000 },
    ]);
  });

  it("supports decimal rupee amounts at exact paise precision", () => {
    const split = computeItemizedSplit({
      items: [customItem("Decimal item", 18000, { a: toPaise("120.50"), b: toPaise("59.50") })],
      charges: [],
    });
    expect(split.shares).toEqual({ a: 12050, b: 5950 });
    expect(split.total).toBe(18000);
  });

  it("reconciles proportional tax and discount against unequal item allocations", () => {
    const bill = {
      items: [customItem("Dish", 18000, { a: 12000, b: 6000 })],
      charges: [charge("tax", 1800, "proportional"), charge("discount", 900, "proportional")],
    };
    const split = computeItemizedSplit(bill);
    expect(split.shares).toEqual({ a: 12600, b: 6300 });
    expect(split.total).toBe(18900);
    expect(Object.values(split.shares).reduce((sum, amount) => sum + amount, 0)).toBe(split.total);
    expect(validateItemizedBill(bill, 18900)).toEqual([]);
  });

  it.each([
    { a: 12000, b: 5000 },
    { a: 12000, b: 7000 },
  ])("rejects custom amounts that do not exactly match the item total", (customShares) => {
    const errors = validateItemizedBill({ items: [customItem("Dish", 18000, customShares)], charges: [] }, 18000);
    expect(errors).toContain("Dish allocations must add up to ₹180");
  });

  it("rejects negative allocations and allocations for unselected members", () => {
    const bill = {
      items: [{ ...customItem("Dish", 18000, { a: 18000 }), customShares: { a: -1, b: 18001 } }],
      charges: [],
    };
    expect(validateItemizedBill(bill, 18000)).toContain("Dish has invalid custom allocations");
  });
});

describe("scanned bill → item-wise custom split → exact reconciliation", () => {
  it("assigns different amounts per member on each scanned item and matches the bill total to the paisa", async () => {
    const { scannedToDraft, draftToBill } = await import("./bill-draft");
    // What the bill reader returns (rupees, with decimals).
    const draft = scannedToDraft({
      isReceipt: true, merchant: "Cafe Mocha", date: "2026-11-20", subtotal: 1047.5, grandTotal: 1099.88,
      items: [
        { name: "Pizza", quantity: 1, unitPrice: 649.5, totalPrice: 649.5 },
        { name: "Mocktails", quantity: 2, unitPrice: 199, totalPrice: 398 },
      ],
      charges: [{ label: "GST 5%", type: "tax", amount: 52.38 }],
    });
    const [pizza, drinks] = draft.items;
    if (!pizza || !drinks) throw new Error("items missing");
    // Pizza: a ₹400, b ₹149.50, c ₹100. Mocktails: a ₹0.01, b ₹397.99.
    Object.assign(pizza, { memberIds: ["a", "b", "c"], splitMode: "custom", customShares: { a: "400", b: "149.50", c: "100" } });
    Object.assign(drinks, { memberIds: ["a", "b"], splitMode: "custom", customShares: { a: "0.01", b: "397.99" } });

    const bill = draftToBill(draft);
    expect(validateItemizedBill(bill, toPaise("1099.88"))).toEqual([]);
    const split = computeItemizedSplit(bill);
    expect(split.total).toBe(109988);
    expect(Object.values(split.shares).reduce((x, y) => x + y, 0)).toBe(109988);
    expect(split.perMember["a"]?.items).toBe(40001);
    expect(split.perMember["b"]?.items).toBe(54749);
    expect(split.perMember["c"]?.items).toBe(10000);
    expect(Object.values(split.shares).every(Number.isInteger)).toBe(true);
  });

  it("blocks saving when one scanned item's member amounts are off by one paisa", async () => {
    const { scannedToDraft, draftToBill } = await import("./bill-draft");
    const draft = scannedToDraft({
      isReceipt: true, merchant: null, date: null, subtotal: 100, grandTotal: 100, charges: [],
      items: [{ name: "Thali", quantity: 1, unitPrice: 100, totalPrice: 100 }],
    });
    Object.assign(draft.items[0]!, { memberIds: ["a", "b"], splitMode: "custom", customShares: { a: "60", b: "39.99" } });
    expect(validateItemizedBill(draftToBill(draft), 10000)).toContain("Thali allocations must add up to ₹100");
  });
});
