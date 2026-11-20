import { useMemo } from "react";
import { computeBalances, minimizeTransactions, pairwiseDebts } from "./calc";
import { useActiveGroup } from "./store";

export function useGroupStats() {
  const ctx = useActiveGroup();
  const { members, expenses, payments } = ctx;
  return useMemo(() => {
    const memberIds = members.map((m) => m.id);
    const balances = computeBalances(memberIds, expenses, payments);
    const settlements = minimizeTransactions(balances);
    const debts = pairwiseDebts(expenses, payments);
    const total = expenses.reduce((a, e) => a + e.amount, 0);
    const byId = new Map(members.map((m) => [m.id, m]));
    const outstanding = settlements.reduce((a, t) => a + t.amount, 0);
    return { ...ctx, balances, settlements, debts, total, byId, outstanding };
  }, [ctx, members, expenses, payments]);
}
