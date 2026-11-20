/** All money is stored as integer paise (₹1 = 100) to avoid floating point drift. */
export type Paise = number;

export type CategoryId = "food" | "rent" | "travel" | "groceries" | "utilities" | "fun" | "other";

export interface Group {
  id: string;
  name: string;
  emoji: string;
  description: string;
  createdAt: string;
}

export interface Member {
  id: string;
  groupId: string;
  name: string;
  upiId: string;
  color: number; // index into avatar palette
}

export type SplitType = "equal" | "unequal";

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: Paise;
  paidBy: string;
  date: string; // yyyy-mm-dd
  category: CategoryId;
  splitType: SplitType;
  /** memberId -> share in paise; always sums to amount */
  shares: Record<string, Paise>;
  /** Present when the expense was split item by item from a bill. */
  bill?: ItemizedBill;
}

export type ChargeKind = "tax" | "service" | "delivery" | "packaging" | "tip" | "discount" | "other";

/** One line on a bill. Legacy items without a split mode are divided equally. */
export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: Paise;
  total: Paise;
  memberIds: string[];
  splitMode?: "equal" | "custom";
  /** Per-member allocation in paise when splitMode is custom. */
  customShares?: Record<string, Paise>;
}

/**
 * Tax, delivery, discount etc. Amount is always positive; discounts are
 * subtracted. Empty memberIds means "everyone who has an item on the bill".
 */
export interface BillCharge {
  id: string;
  label: string;
  kind: ChargeKind;
  amount: Paise;
  split: "equal" | "proportional";
  memberIds: string[];
}

export interface ItemizedBill {
  merchant?: string;
  items: BillItem[];
  charges: BillCharge[];
}

/** A recorded settle-up payment from one member to another. */
export interface Payment {
  id: string;
  groupId: string;
  from: string;
  to: string;
  amount: Paise;
  date: string;
}

export interface AppState {
  groups: Group[];
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  activeGroupId: string | null;
}

export interface MemberBalance {
  memberId: string;
  paid: Paise;
  share: Paise;
  sent: Paise;
  received: Paise;
  /** positive = should receive money, negative = owes money */
  net: Paise;
}

export interface Transfer {
  from: string;
  to: string;
  amount: Paise;
}
