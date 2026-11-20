import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { createSampleState } from "./sample-data";
import type { AppState, Expense, Group, Member, Payment } from "./types";

const STORAGE_KEY = "splitmate:v1";

type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "reset" }
  | { type: "setActiveGroup"; id: string }
  | { type: "addGroup"; group: Group; members: Member[] }
  | { type: "updateGroup"; group: Group }
  | { type: "deleteGroup"; id: string }
  | { type: "addMember"; member: Member }
  | { type: "updateMember"; member: Member }
  | { type: "removeMember"; id: string }
  | { type: "upsertExpense"; expense: Expense }
  | { type: "deleteExpense"; id: string }
  | { type: "addPayment"; payment: Payment }
  | { type: "deletePayment"; id: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "reset":
      return createSampleState();
    case "setActiveGroup":
      return { ...state, activeGroupId: action.id };
    case "addGroup":
      return {
        ...state,
        groups: [...state.groups, action.group],
        members: [...state.members, ...action.members],
        activeGroupId: action.group.id,
      };
    case "updateGroup":
      return { ...state, groups: state.groups.map((g) => (g.id === action.group.id ? action.group : g)) };
    case "deleteGroup": {
      const groups = state.groups.filter((g) => g.id !== action.id);
      return {
        groups,
        members: state.members.filter((m) => m.groupId !== action.id),
        expenses: state.expenses.filter((e) => e.groupId !== action.id),
        payments: state.payments.filter((p) => p.groupId !== action.id),
        activeGroupId: state.activeGroupId === action.id ? (groups[0]?.id ?? null) : state.activeGroupId,
      };
    }
    case "addMember":
      return { ...state, members: [...state.members, action.member] };
    case "updateMember":
      return { ...state, members: state.members.map((m) => (m.id === action.member.id ? action.member : m)) };
    case "removeMember":
      return { ...state, members: state.members.filter((m) => m.id !== action.id) };
    case "upsertExpense": {
      const exists = state.expenses.some((e) => e.id === action.expense.id);
      return {
        ...state,
        expenses: exists
          ? state.expenses.map((e) => (e.id === action.expense.id ? action.expense : e))
          : [...state.expenses, action.expense],
      };
    }
    case "deleteExpense":
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };
    case "addPayment":
      return { ...state, payments: [...state.payments, action.payment] };
    case "deletePayment":
      return { ...state, payments: state.payments.filter((p) => p.id !== action.id) };
  }
}

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function SplitMateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createSampleState);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", state: JSON.parse(raw) as AppState });
    } catch {
      // ignore corrupt storage and keep sample data
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside SplitMateProvider");
  return ctx;
}

/** Everything about the currently selected group. */
export function useActiveGroup() {
  const { state, dispatch } = useStore();
  const group = state.groups.find((g) => g.id === state.activeGroupId) ?? state.groups[0] ?? null;
  const members = group ? state.members.filter((m) => m.groupId === group.id) : [];
  const expenses = group
    ? state.expenses.filter((e) => e.groupId === group.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const payments = group ? state.payments.filter((p) => p.groupId === group.id) : [];
  return { group, members, expenses, payments, dispatch, state };
}

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};
