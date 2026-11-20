import { describe, expect, it } from "vitest";
import { buildUpiLink, computeBalances, minimizeTransactions, pairwiseDebts, splitEqually, sumShares } from "./calc";
import type { Expense } from "./types";

const exp = (paidBy: string, amount: number, shares: Record<string, number>): Expense => ({
  id: Math.random().toString(),
  groupId: "g",
  description: "x",
  amount,
  paidBy,
  date: "2026-11-01",
  category: "food",
  splitType: "unequal",
  shares,
});

describe("equal split", () => {
  it("splits ₹100 three ways into shares that add up exactly", () => {
    const s = splitEqually(10000, ["a", "b", "c"]);
    expect(s).toEqual({ a: 3334, b: 3333, c: 3333 });
    expect(sumShares(s)).toBe(10000);
  });
});

describe("balances", () => {
  it("gives paid, share and net per member", () => {
    const b = computeBalances(["a", "b"], [exp("a", 1000, { a: 400, b: 600 })]);
    expect(b.find((x) => x.memberId === "a")).toMatchObject({ paid: 1000, share: 400, net: 600 });
    expect(b.find((x) => x.memberId === "b")).toMatchObject({ paid: 0, share: 600, net: -600 });
  });

  it("a recorded payment clears the debt", () => {
    const b = computeBalances(["a", "b"], [exp("a", 1000, { a: 400, b: 600 })], [
      { id: "p", groupId: "g", from: "b", to: "a", amount: 600, date: "2026-11-02" },
    ]);
    expect(b.every((x) => x.net === 0)).toBe(true);
  });
});

describe("minimum transactions", () => {
  it("settles two independent pairs with 2 payments, not 3", () => {
    // a +5, b -5, c +3, d -3 — greedy by size could cross pairs; optimum is 2.
    const t = minimizeTransactions([
      { memberId: "a", net: 500 },
      { memberId: "b", net: -500 },
      { memberId: "c", net: 300 },
      { memberId: "d", net: -300 },
    ]);
    expect(t).toHaveLength(2);
  });

  it("uses fewer payments than greedy when a zero-sum subgroup exists", () => {
    // Zero-sum subgroups {+6,-4,-2} and {+5,-5} → optimum is 3 transfers.
    const t = minimizeTransactions([
      { memberId: "a", net: 600 },
      { memberId: "b", net: 500 },
      { memberId: "c", net: -500 },
      { memberId: "d", net: -400 },
      { memberId: "e", net: -200 },
    ]);
    expect(t).toHaveLength(3);
  });

  it("leaves everyone at zero after applying the transfers", () => {
    const nets: Record<string, number> = { a: 1234, b: -777, c: -457, d: 999, e: -999 };
    const t = minimizeTransactions(Object.entries(nets).map(([memberId, net]) => ({ memberId, net })));
    for (const x of t) {
      nets[x.from] = (nets[x.from] ?? 0) + x.amount;
      nets[x.to] = (nets[x.to] ?? 0) - x.amount;
    }
    expect(Object.values(nets).every((v) => v === 0)).toBe(true);
  });
});

describe("who owes whom", () => {
  it("nets debts in both directions between a pair", () => {
    const d = pairwiseDebts([exp("a", 1000, { a: 500, b: 500 }), exp("b", 600, { a: 300, b: 300 })]);
    expect(d).toEqual([{ from: "b", to: "a", amount: 200 }]);
  });
});

describe("UPI link", () => {
  it("includes payee, amount in rupees and INR", () => {
    const link = buildUpiLink({ upiId: "priya@okicici", payeeName: "Priya", amount: 45050, note: "Goa" });
    expect(link.startsWith("upi://pay?")).toBe(true);
    const q = new URLSearchParams(link.split("?")[1]);
    expect(q.get("pa")).toBe("priya@okicici");
    expect(q.get("am")).toBe("450.50");
    expect(q.get("cu")).toBe("INR");
  });
});
