import type { BillCharge, Expense, ItemizedBill, MemberBalance, Paise, Payment, Transfer } from "./types";

export const toPaise = (rupees: number | string): Paise => {
  const n = typeof rupees === "string" ? parseFloat(rupees) : rupees;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

export const fromPaise = (p: Paise) => p / 100;

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,260 for whole rupees, ₹157.50 when there are paise. */
export const formatINR = (p: Paise) => (p % 100 === 0 ? inrWhole : inrPaise).format(p / 100);

/**
 * Split an amount equally between members. Leftover paise go one each to the
 * first members so shares always add up to the exact total.
 */
export function splitEqually(amount: Paise, memberIds: string[]): Record<string, Paise> {
  const result: Record<string, Paise> = {};
  if (memberIds.length === 0) return result;
  const base = Math.floor(amount / memberIds.length);
  let remainder = amount - base * memberIds.length;
  for (const id of memberIds) {
    result[id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  }
  return result;
}

export const sumShares = (shares: Record<string, Paise>) =>
  Object.values(shares).reduce((a, b) => a + b, 0);

/** Paid, share and net balance per member. Settle-up payments move balances toward zero. */
export function computeBalances(
  memberIds: string[],
  expenses: Expense[],
  payments: Payment[] = [],
): MemberBalance[] {
  const map = new Map<string, MemberBalance>();
  for (const id of memberIds) {
    map.set(id, { memberId: id, paid: 0, share: 0, sent: 0, received: 0, net: 0 });
  }
  for (const e of expenses) {
    const payer = map.get(e.paidBy);
    if (payer) payer.paid += e.amount;
    for (const [id, s] of Object.entries(e.shares)) {
      const m = map.get(id);
      if (m) m.share += s;
    }
  }
  for (const p of payments) {
    const from = map.get(p.from);
    const to = map.get(p.to);
    if (from) from.sent += p.amount;
    if (to) to.received += p.amount;
  }
  for (const b of map.values()) {
    b.net = b.paid - b.share + b.sent - b.received;
  }
  return [...map.values()];
}

/**
 * Direct "who owes whom" based on who paid for whom, netted per pair, before
 * any simplification. Payments reduce the debt between that pair.
 */
export function pairwiseDebts(expenses: Expense[], payments: Payment[] = []): Transfer[] {
  const owed = new Map<string, number>(); // key "debtor|creditor"
  const add = (debtor: string, creditor: string, amt: number) => {
    if (debtor === creditor || amt === 0) return;
    const k = `${debtor}|${creditor}`;
    owed.set(k, (owed.get(k) ?? 0) + amt);
  };
  for (const e of expenses) {
    for (const [id, s] of Object.entries(e.shares)) add(id, e.paidBy, s);
  }
  for (const p of payments) add(p.to, p.from, p.amount);

  const result: Transfer[] = [];
  const seen = new Set<string>();
  for (const [k, v] of owed) {
    const [a, b] = k.split("|") as [string, string];
    const pairKey = [a, b].sort().join("|");
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    const reverse = owed.get(`${b}|${a}`) ?? 0;
    const net = v - reverse;
    if (net > 0) result.push({ from: a, to: b, amount: net });
    else if (net < 0) result.push({ from: b, to: a, amount: -net });
  }
  return result.sort((x, y) => y.amount - x.amount);
}

/** Greedy: repeatedly match the biggest debtor with the biggest creditor. */
function greedySettle(entries: { id: string; net: number }[]): Transfer[] {
  const creditors = entries.filter((e) => e.net > 0).map((e) => ({ ...e }));
  const debtors = entries.filter((e) => e.net < 0).map((e) => ({ id: e.id, net: -e.net }));
  const out: Transfer[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.net - a.net);
    debtors.sort((a, b) => b.net - a.net);
    const c = creditors[0]!;
    const d = debtors[0]!;
    const amt = Math.min(c.net, d.net);
    out.push({ from: d.id, to: c.id, amount: amt });
    c.net -= amt;
    d.net -= amt;
    if (c.net === 0) creditors.shift();
    if (d.net === 0) debtors.shift();
  }
  return out;
}

const EXACT_LIMIT = 14;

/**
 * Minimum number of transactions to settle all balances.
 *
 * The minimum equals (people with non-zero balance) − (max number of disjoint
 * groups whose balances sum to zero). We find that partition with a bitmask DP,
 * then settle each zero-sum group with k−1 transfers. Falls back to greedy for
 * very large groups.
 */
export function minimizeTransactions(balances: { memberId: string; net: Paise }[]): Transfer[] {
  const people = balances.filter((b) => b.net !== 0).map((b) => ({ id: b.memberId, net: b.net }));
  const n = people.length;
  if (n === 0) return [];
  if (n > EXACT_LIMIT) return greedySettle(people);

  const size = 1 << n;
  const sum = new Array<number>(size).fill(0);
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    const i = 31 - Math.clz32(low);
    sum[mask] = sum[mask ^ low]! + people[i]!.net;
  }
  const dp = new Array<number>(size).fill(0);
  for (let mask = 1; mask < size; mask++) {
    let best = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) best = Math.max(best, dp[mask ^ (1 << i)]!);
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // Peel off zero-sum subsets that keep the optimum.
  const groups: number[] = [];
  let mask = size - 1;
  while (mask) {
    const target = dp[mask]! - 1;
    let chosen = mask;
    // smallest-first search over submasks
    for (let sub = mask; sub; sub = (sub - 1) & mask) {
      if (sum[sub] === 0 && dp[mask ^ sub] === target) {
        if (popcount(sub) < popcount(chosen)) chosen = sub;
      }
    }
    groups.push(chosen);
    mask ^= chosen;
  }

  const out: Transfer[] = [];
  for (const g of groups) {
    const members = people.filter((_, i) => g & (1 << i));
    out.push(...greedySettle(members));
  }
  return out.sort((a, b) => b.amount - a.amount);
}

function popcount(x: number) {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** Standard UPI deep link (NPCI spec) that opens GPay, PhonePe, Paytm, etc. */
export function buildUpiLink(opts: {
  upiId: string;
  payeeName: string;
  amount: Paise;
  note: string;
}): string {
  const params = new URLSearchParams({
    pa: opts.upiId.trim(),
    pn: opts.payeeName,
    am: (opts.amount / 100).toFixed(2),
    cu: "INR",
    tn: opts.note.slice(0, 80),
  });
  return `upi://pay?${params.toString()}`;
}

export const isValidUpiId = (v: string) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(v.trim());

/* ───────────────────────── Item-wise bill splitting ───────────────────────── */

/**
 * Divide an amount by weights using the largest-remainder method so the parts
 * add up exactly. Negative amounts (discounts) are allocated as negative parts.
 * With no positive weight, falls back to an equal split.
 */
export function allocateProportionally(amount: Paise, weights: Record<string, number>): Record<string, Paise> {
  const ids = Object.keys(weights);
  if (ids.length === 0) return {};
  const totalWeight = ids.reduce((a, id) => a + Math.max(0, weights[id] ?? 0), 0);
  if (totalWeight <= 0) return splitEqually(amount, ids);
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  const parts = ids.map((id) => {
    const exact = (abs * Math.max(0, weights[id] ?? 0)) / totalWeight;
    return { id, base: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = abs - parts.reduce((a, p) => a + p.base, 0);
  const order = [...parts].sort((a, b) => b.frac - a.frac);
  for (const p of order) {
    if (left <= 0) break;
    p.base += 1;
    left--;
  }
  return Object.fromEntries(parts.map((p) => [p.id, sign * p.base]));
}

export const signedCharge = (c: Pick<BillCharge, "kind" | "amount">): Paise =>
  c.kind === "discount" ? -Math.abs(c.amount) : c.amount;

export interface ItemizedSplit {
  itemsTotal: Paise;
  /** Net of all charges; discounts make this smaller. */
  chargesTotal: Paise;
  /** itemsTotal + chargesTotal */
  total: Paise;
  perMember: Record<string, { items: Paise; charges: Paise; total: Paise }>;
  /** memberId -> final share (members with a zero share are left out) */
  shares: Record<string, Paise>;
}

function splitBillItem(item: ItemizedBill["items"][number]): Record<string, Paise> {
  if (item.splitMode !== "custom") return splitEqually(item.total, item.memberIds);
  return Object.fromEntries(item.memberIds.map((id) => [id, item.customShares?.[id] ?? 0]));
}

/** Each member's share of a bill: their items, plus their part of each charge. */
export function computeItemizedSplit(bill: Pick<ItemizedBill, "items" | "charges">): ItemizedSplit {
  const perMember: ItemizedSplit["perMember"] = {};
  const row = (id: string) => (perMember[id] ??= { items: 0, charges: 0, total: 0 });

  let itemsTotal = 0;
  for (const item of bill.items) {
    itemsTotal += item.total;
    for (const [id, s] of Object.entries(splitBillItem(item))) row(id).items += s;
  }
  const onBill = Object.keys(perMember).filter((id) => (perMember[id]?.items ?? 0) !== 0);

  let chargesTotal = 0;
  for (const c of bill.charges) {
    const amt = signedCharge(c);
    chargesTotal += amt;
    const ids = c.memberIds.length ? c.memberIds : onBill;
    if (ids.length === 0 || amt === 0) continue;
    const parts =
      c.split === "proportional"
        ? allocateProportionally(amt, Object.fromEntries(ids.map((id) => [id, perMember[id]?.items ?? 0])))
        : splitEqually(amt, ids);
    for (const [id, s] of Object.entries(parts)) row(id).charges += s;
  }

  const shares: Record<string, Paise> = {};
  for (const [id, r] of Object.entries(perMember)) {
    r.total = r.items + r.charges;
    if (r.total !== 0) shares[id] = r.total;
  }
  return { itemsTotal, chargesTotal, total: itemsTotal + chargesTotal, perMember, shares };
}

/** Problems that stop an itemized bill from being saved. Empty array = OK. */
export function validateItemizedBill(bill: Pick<ItemizedBill, "items" | "charges">, billTotal: Paise): string[] {
  const errors: string[] = [];
  if (bill.items.length === 0) errors.push("Add at least one item");
  bill.items.forEach((it, i) => {
    const label = it.name.trim() || `Item ${i + 1}`;
    if (it.total <= 0) errors.push(`${label} needs a price above ₹0`);
    if (it.memberIds.length === 0) errors.push(`${label} isn't assigned to anyone`);
    if (it.splitMode === "custom") {
      const allocations = it.customShares ?? {};
      let allocated = 0;
      let invalid = false;
      for (const [id, amount] of Object.entries(allocations)) {
        if (!it.memberIds.includes(id) || !Number.isSafeInteger(amount) || amount < 0) invalid = true;
      }
      for (const id of it.memberIds) {
        const amount = allocations[id] ?? 0;
        if (!Number.isSafeInteger(amount) || amount < 0) invalid = true;
        allocated += amount;
      }
      if (!Number.isSafeInteger(allocated)) invalid = true;
      if (invalid) errors.push(`${label} has invalid custom allocations`);
      if (it.memberIds.length > 0 && allocated !== it.total)
        errors.push(`${label} allocations must add up to ${formatINR(it.total)}`);
    }
  });
  const split = computeItemizedSplit(bill);
  bill.charges.forEach((c) => {
    const ids = c.memberIds.length ? c.memberIds : Object.keys(split.perMember);
    if (c.amount !== 0 && ids.length === 0) errors.push(`${c.label || "A charge"} has no one to split with`);
  });
  if (billTotal <= 0) errors.push("Enter the bill total");
  const diff = billTotal - split.total;
  if (billTotal > 0 && diff !== 0)
    errors.push(diff > 0 ? `Items and charges are ${formatINR(diff)} short of the bill total` : `Items and charges exceed the bill total by ${formatINR(-diff)}`);
  if (Object.values(split.shares).some((s) => s < 0)) errors.push("A discount is bigger than someone's items — assign it to fewer people");
  return errors;
}
