import { describe, expect, it } from "vitest";
import { buildUpiLink, computeBalances, minimizeTransactions, pairwiseDebts, splitEqually, sumShares, toPaise, validateCustomSplit } from "./calc";
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

/* ───────────── Hackathon requirement audit ───────────── */

describe("rupees to paise", () => {
  it.each([
    ["157.5", 15750],
    ["0.1", 10],
    ["4.35", 435],
    ["1.005", 101],
    ["1,234.56", 123456],
    ["-12.34", -1234],
    ["", 0],
    ["abc", 0],
  ])("converts %s to %i paise", (input, paise) => {
    expect(toPaise(input)).toBe(paise);
  });

  it("converts numbers without float drift", () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(19.99)).toBe(1999);
  });
});

describe("custom amounts split", () => {
  it("accepts amounts that add up exactly to the total", () => {
    expect(validateCustomSplit(100000, { a: 45050, b: 30000, c: 24950 })).toEqual([]);
  });

  it("reports unassigned money", () => {
    expect(validateCustomSplit(100000, { a: 45050, b: 30000 })).toEqual(["₹249.50 still unassigned"]);
  });

  it("reports amounts over the total", () => {
    expect(validateCustomSplit(10000, { a: 6000, b: 4001 })).toEqual(["Custom amounts exceed total by ₹0.01"]);
  });

  it("rejects negative amounts and an empty split", () => {
    expect(validateCustomSplit(10000, { a: 12000, b: -2000 })).toEqual(["Custom amounts can't be negative"]);
    expect(validateCustomSplit(10000, {})).toEqual(["Enter at least one custom amount"]);
  });
});

/** Reference answer: exhaustive search for the fewest transfers (classic backtracking). */
function bruteForceMin(nets: number[]): number {
  const debts = nets.filter((x) => x !== 0);
  const dfs = (start: number): number => {
    while (start < debts.length && debts[start] === 0) start++;
    if (start === debts.length) return 0;
    let best = Infinity;
    for (let i = start + 1; i < debts.length; i++) {
      if (debts[i]! * debts[start]! < 0) {
        debts[i]! += debts[start]!;
        best = Math.min(best, 1 + dfs(start + 1));
        debts[i]! -= debts[start]!;
      }
    }
    return best;
  };
  return dfs(0);
}

/** Apply transfers to balances; returns the leftover balances. */
function applyTransfers(nets: Record<string, number>, transfers: { from: string; to: string; amount: number }[]) {
  const left = { ...nets };
  for (const t of transfers) {
    left[t.from] = (left[t.from] ?? 0) + t.amount;
    left[t.to] = (left[t.to] ?? 0) - t.amount;
  }
  return left;
}

function randomNets(rand: () => number, people: number): Record<string, number> {
  const nets: Record<string, number> = {};
  let sum = 0;
  for (let i = 0; i < people - 1; i++) {
    // Mix of positive, negative, zero and paise-level amounts, some exact opposites.
    const r = rand();
    const v = r < 0.15 ? 0 : r < 0.3 && i > 0 ? -(nets[`m${i - 1}`] ?? 0) : Math.round((rand() - 0.5) * 2000000) / 1;
    nets[`m${i}`] = v;
    sum += v;
  }
  nets[`m${people - 1}`] = -sum;
  return nets;
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("minimum-transactions settlement", () => {
  it("returns nothing when everyone is already at zero", () => {
    expect(minimizeTransactions([{ memberId: "a", net: 0 }, { memberId: "b", net: 0 }])).toEqual([]);
  });

  it("ignores people with a zero balance", () => {
    const t = minimizeTransactions([
      { memberId: "a", net: 15050 },
      { memberId: "z", net: 0 },
      { memberId: "b", net: -15050 },
    ]);
    expect(t).toEqual([{ from: "b", to: "a", amount: 15050 }]);
  });

  it("handles decimal rupee balances in exact paise", () => {
    const nets = { a: toPaise("333.34"), b: toPaise("-166.67"), c: toPaise("-166.67") };
    const t = minimizeTransactions(Object.entries(nets).map(([memberId, net]) => ({ memberId, net })));
    expect(t).toEqual([
      { from: "b", to: "a", amount: 16667 },
      { from: "c", to: "a", amount: 16667 },
    ]);
  });

  it("matches the exhaustive-search minimum and clears every balance on 300 random groups", () => {
    const rand = seeded(42);
    for (let run = 0; run < 300; run++) {
      const nets = randomNets(rand, 2 + Math.floor(rand() * 8)); // 2–9 people
      const t = minimizeTransactions(Object.entries(nets).map(([memberId, net]) => ({ memberId, net })));
      expect(t.length).toBe(bruteForceMin(Object.values(nets)));
      expect(Object.values(applyTransfers(nets, t)).every((v) => v === 0)).toBe(true);
      for (const x of t) {
        expect(Number.isInteger(x.amount)).toBe(true);
        expect(x.amount).toBeGreaterThan(0);
        expect(x.from).not.toBe(x.to);
      }
    }
  });

  it("still clears every balance for a large group (20 people)", () => {
    const nets = randomNets(seeded(7), 20);
    const t = minimizeTransactions(Object.entries(nets).map(([memberId, net]) => ({ memberId, net })));
    expect(Object.values(applyTransfers(nets, t)).every((v) => v === 0)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(19);
  });

  it("settles real expenses end to end: balances, then payments, then everyone at zero", () => {
    const expenses = [
      exp("a", 120000, splitEqually(120000, ["a", "b", "c"])),
      exp("b", 45050, { a: 15000, b: 15050, c: 15000 }),
      exp("c", 9999, splitEqually(9999, ["a", "b", "c", "d"])),
    ];
    const balances = computeBalances(["a", "b", "c", "d"], expenses);
    const t = minimizeTransactions(balances);
    const payments = t.map((x, i) => ({ id: `p${i}`, groupId: "g", from: x.from, to: x.to, amount: x.amount, date: "2026-11-20" }));
    expect(computeBalances(["a", "b", "c", "d"], expenses, payments).every((b) => b.net === 0)).toBe(true);
  });
});

describe("UPI deep link", () => {
  const link = buildUpiLink({ upiId: " rahul.k@okaxis ", payeeName: "Rahul Kumar", amount: 123456, note: "SplitMate Flat 4B - Priya to Rahul" });
  const params = new URLSearchParams(link.slice("upi://pay?".length));

  it("uses the standard upi://pay format with every field prefilled", () => {
    expect(link.startsWith("upi://pay?pa=rahul.k@okaxis&pn=")).toBe(true);
    expect(params.get("pa")).toBe("rahul.k@okaxis");
    expect(params.get("pn")).toBe("Rahul Kumar");
    expect(params.get("am")).toBe("1234.56");
    expect(params.get("cu")).toBe("INR");
    expect(params.get("tn")).toBe("SplitMate Flat 4B - Priya to Rahul");
  });

  it("encodes spaces as %20, not +", () => {
    expect(link).toContain("pn=Rahul%20Kumar");
    expect(link).not.toContain("+");
  });

  it("formats amounts with exactly two decimals", () => {
    const am = (amount: number) =>
      new URLSearchParams(buildUpiLink({ upiId: "ab@ybl", payeeName: "A", amount, note: "x" }).split("?")[1]).get("am");
    expect(am(1)).toBe("0.01");
    expect(am(100)).toBe("1.00");
    expect(am(45050)).toBe("450.50");
  });

  it("removes emoji and symbols that UPI apps reject, keeping names", () => {
    const l = buildUpiLink({ upiId: "ab@ybl", payeeName: "Zoya 🎉 & co", amount: 100, note: "Goa 🏖️ trip · SplitMate" });
    const q = new URLSearchParams(l.split("?")[1]);
    expect(q.get("pn")).toBe("Zoya co");
    expect(q.get("tn")).toBe("Goa trip SplitMate");
  });

  it("keeps the note within 80 characters", () => {
    const l = buildUpiLink({ upiId: "ab@ybl", payeeName: "A", amount: 100, note: "x".repeat(200) });
    expect(new URLSearchParams(l.split("?")[1]).get("tn")).toHaveLength(80);
  });

  it("refuses an invalid UPI ID or a zero amount", () => {
    expect(() => buildUpiLink({ upiId: "not-a-upi", payeeName: "A", amount: 100, note: "x" })).toThrow();
    expect(() => buildUpiLink({ upiId: "ab@ybl", payeeName: "A", amount: 0, note: "x" })).toThrow();
  });
});

describe("UPI deep link with Indian-language names", () => {
  it("keeps Devanagari names intact, including vowel signs", () => {
    const l = buildUpiLink({ upiId: "priya@okicici", payeeName: "प्रिया", amount: 100, note: "किराया" });
    const q = new URLSearchParams(l.split("?")[1]);
    expect(q.get("pn")).toBe("प्रिया");
    expect(q.get("tn")).toBe("किराया");
  });
});
