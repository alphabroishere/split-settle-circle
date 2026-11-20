import { useEffect, useState, type ReactNode } from "react";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/splitmate/categories";
import { computeItemizedSplit, formatINR, splitEqually, sumShares, toPaise, validateItemizedBill } from "@/lib/splitmate/calc";
import { billToDraft, draftToBill, emptyDraft, type BillDraft } from "@/lib/splitmate/bill-draft";
import type { ScannedBill } from "@/lib/splitmate/bill-scan.functions";
import { todayISO, uid, useActiveGroup } from "@/lib/splitmate/store";
import type { CategoryId, Expense } from "@/lib/splitmate/types";
import { MemberAvatar } from "./bits";
import { BillSplitEditor } from "./bill-split";

type SplitMode = "equal" | "unequal" | "items";
const MODES: { id: SplitMode; label: string }[] = [
  { id: "equal", label: "Equally" },
  { id: "unequal", label: "Custom amounts" },
  { id: "items", label: "Split by items" },
];

interface Props {
  trigger?: ReactNode;
  expense?: Expense | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ExpenseDialog({ trigger, expense, open: openProp, onOpenChange }: Props) {
  const { group, members, dispatch } = useActiveGroup();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<CategoryId>("food");
  const [splitType, setSplitType] = useState<SplitMode>("equal");
  const [draft, setDraftState] = useState<BillDraft>(emptyDraft);
  const setDraft = (fn: (d: BillDraft) => BillDraft) => setDraftState(fn);
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setDescription(expense.description);
      setAmount(String(expense.amount / 100));
      setPaidBy(expense.paidBy);
      setDate(expense.date);
      setCategory(expense.category);
      setSplitType(expense.bill ? "items" : expense.splitType);
      setDraftState(expense.bill ? billToDraft(expense.bill) : emptyDraft());
      setSelected(Object.keys(expense.shares));
      setCustom(Object.fromEntries(Object.entries(expense.shares).map(([k, v]) => [k, String(v / 100)])));
    } else {
      setDescription("");
      setAmount("");
      setPaidBy(members[0]?.id ?? "");
      setDate(todayISO());
      setCategory("food");
      setSplitType("equal");
      setDraftState(emptyDraft());
      setSelected(members.map((m) => m.id));
      setCustom({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const total = toPaise(amount || 0);
  const equalShares = splitEqually(total, selected);
  const customShares: Record<string, number> = {};
  for (const m of members) {
    const v = toPaise(custom[m.id] || 0);
    if (v > 0) customShares[m.id] = v;
  }
  const customSum = sumShares(customShares);
  const remaining = total - customSum;

  const save = () => {
    if (!group) return;
    if (!description.trim()) { toast.error("Add a short description"); return; }
    if (total <= 0) { toast.error("Enter an amount above ₹0"); return; }
    if (!paidBy) { toast.error("Choose who paid"); return; }
    let shares: Record<string, number>;
    let bill: Expense["bill"];
    if (splitType === "items") {
      bill = draftToBill(draft);
      const errors = validateItemizedBill(bill, total);
      if (errors.length) { toast.error(errors[0], errors.length > 1 ? { description: `+${errors.length - 1} more to fix` } : undefined); return; }
      shares = computeItemizedSplit(bill).shares;
    } else if (splitType === "equal") {
      if (selected.length === 0) { toast.error("Pick at least one person to split with"); return; }
      shares = equalShares;
    } else {
      if (Object.keys(customShares).length === 0) { toast.error("Enter at least one custom amount"); return; }
      if (remaining !== 0)
        { toast.error(
          remaining > 0 ? `${formatINR(remaining)} still unassigned` : `Custom amounts exceed total by ${formatINR(-remaining)}`,
        ); return; }
      shares = customShares;
    }
    dispatch({
      type: "upsertExpense",
      expense: {
        id: expense?.id ?? uid("exp"),
        groupId: group.id,
        description: description.trim(),
        amount: total,
        paidBy,
        date,
        category,
        splitType: splitType === "equal" ? "equal" : "unequal",
        shares,
        ...(bill ? { bill } : {}),
      },
    });
    toast.success(expense ? "Expense updated" : "Expense added", { description: `${description.trim()} · ${formatINR(total)}` });
    setOpen(false);
  };

  const fillRemaining = () => {
    const blanks = members.filter((m) => !custom[m.id]);
    if (blanks.length === 0 || remaining <= 0) return;
    const parts = splitEqually(remaining, blanks.map((m) => m.id));
    setCustom((c) => ({ ...c, ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, String(v / 100)])) }));
  };

  const onScanned = (b: ScannedBill) => {
    if (b.grandTotal && b.grandTotal > 0) setAmount(String(Math.round(b.grandTotal * 100) / 100));
    if (!description.trim() && b.merchant) setDescription(b.merchant);
    if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) setDate(b.date);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn("max-h-[92svh] overflow-y-auto", splitType === "items" ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{expense ? "Edit expense" : "Add an expense"}</DialogTitle>
          <DialogDescription>{group ? `In ${group.emoji} ${group.name}` : "Create a group first"}</DialogDescription>
        </DialogHeader>

        {members.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Add members to this group before recording expenses.</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="exp-desc">What was it for?</Label>
              <Input id="exp-desc" placeholder="e.g. Maggi at the canteen" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="exp-amt">{splitType === "items" ? "Bill total (₹)" : "Amount (₹)"}</Label>
                <Input id="exp-amt" inputMode="decimal" type="number" min="0" step="0.01" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="money text-lg font-semibold" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="exp-date">Date</Label>
                <Input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Paid by</Label>
                <Select value={paidBy} onValueChange={setPaidBy}>
                  <SelectTrigger aria-label="Paid by"><SelectValue placeholder="Who paid?" /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as CategoryId)}>
                  <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Split</Label>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
                {MODES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={splitType === t.id}
                    onClick={() => setSplitType(t.id)}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm",
                      splitType === t.id ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.id === "items" && <ScanLine className="size-3.5 shrink-0" />}
                    {t.label}
                  </button>
                ))}
              </div>

              {splitType === "items" ? (
                <BillSplitEditor members={members} draft={draft} setDraft={setDraft} billTotal={total} onScanned={onScanned} />
              ) : (
              <ul className="divide-y rounded-xl border">
                {members.map((m) => {
                  const checked = selected.includes(m.id);
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      {splitType === "equal" && (
                        <Checkbox
                          id={`split-${m.id}`}
                          checked={checked}
                          onCheckedChange={(v) => setSelected((s) => (v ? [...s, m.id] : s.filter((x) => x !== m.id)))}
                          aria-label={`Include ${m.name}`}
                        />
                      )}
                      <MemberAvatar member={m} size="sm" />
                      <label htmlFor={`split-${m.id}`} className="flex-1 text-sm font-medium">{m.name}</label>
                      {splitType === "equal" ? (
                        <span className={cn("money text-sm font-semibold", checked ? "text-foreground" : "text-muted-foreground")}>
                          {checked ? formatINR(equalShares[m.id] ?? 0) : "—"}
                        </span>
                      ) : (
                        <div className="relative w-28">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                          <Input
                            aria-label={`${m.name}'s share`}
                            inputMode="decimal"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={custom[m.id] ?? ""}
                            onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))}
                            className="money h-8 pl-6 text-right"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              )}

              {splitType === "unequal" && (
                <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatINR(customSum)} of {formatINR(total)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn("money font-semibold", remaining === 0 ? "text-positive" : "text-negative")}>
                      {remaining === 0 ? "All assigned ✓" : remaining > 0 ? `${formatINR(remaining)} left` : `${formatINR(-remaining)} over`}
                    </span>
                    {remaining > 0 && (
                      <Button type="button" size="sm" variant="ghost" className="h-7" onClick={fillRemaining}>Fill blanks</Button>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="highlight" onClick={save} disabled={members.length === 0}>
            {expense ? "Save changes" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
