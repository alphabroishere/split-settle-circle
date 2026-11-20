import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, formatDate, MemberAvatar, PageHeader } from "@/components/splitmate/bits";
import { ExpenseDialog } from "@/components/splitmate/expense-dialog";
import { CATEGORIES, getCategory } from "@/lib/splitmate/categories";
import { formatINR } from "@/lib/splitmate/calc";
import { useGroupStats } from "@/lib/splitmate/use-group-stats";
import type { Expense } from "@/lib/splitmate/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses · SplitMate" },
      { name: "description", content: "Every shared expense in your group with who paid and how it was split." },
      { property: "og:title", content: "Group expenses · SplitMate" },
      { property: "og:description", content: "Record, edit and review shared expenses split equally or by custom amounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { group, expenses, byId, members, total, dispatch } = useGroupStats();
  const [q, setQ] = useState("");
  const [who, setWho] = useState("all");
  const [cat, setCat] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Expense | undefined>();

  const filtered = expenses.filter(
    (e) =>
      (q === "" || e.description.toLowerCase().includes(q.toLowerCase())) &&
      (who === "all" || e.paidBy === who || who in e.shares) &&
      (cat === "all" || e.category === cat),
  );

  const remove = (e: Expense) => {
    dispatch({ type: "deleteExpense", id: e.id });
    toast("Expense deleted", {
      description: e.description,
      action: { label: "Undo", onClick: () => dispatch({ type: "upsertExpense", expense: e }) },
    });
  };

  if (!group) return <EmptyState emoji="📂" title="Pick or create a group first" />;

  return (
    <>
      <PageHeader
        eyebrow="Expenses"
        title="Every rupee, logged."
        description={`${expenses.length} expenses · ${formatINR(total)} total in ${group.name}`}
        actions={<ExpenseDialog trigger={<Button variant="highlight"><Plus /> Add expense</Button>} />}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search expenses" value={q} onChange={(e) => setQ(e.target.value)} className="bg-card pl-9" />
        </div>
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="bg-card sm:w-44" aria-label="Filter by member"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="bg-card sm:w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState emoji="🍜" title={expenses.length ? "No matches" : "No expenses yet"}>
          {expenses.length ? "Try a different search or filter." : "Add the first one — that late-night Maggi counts."}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => {
            const c = getCategory(e.category);
            const open = openId === e.id;
            return (
              <li key={e.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : e.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                  aria-expanded={open}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <c.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{byId.get(e.paidBy)?.name ?? "Someone"}</span> paid · {formatDate(e.date)} ·{" "}
                      {e.bill ? `split by ${e.bill.items.length} items` : e.splitType === "equal" ? `split ${Object.keys(e.shares).length} ways` : "custom split"}
                    </p>
                  </div>
                  <span className="money font-display text-lg font-bold">{formatINR(e.amount)}</span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="border-t bg-background/60 px-4 py-3">
                    {e.bill && (
                      <ul className="mb-3 grid gap-1 border-b pb-3 text-sm">
                        {e.bill.items.map((it) => (
                          <li key={it.id} className="flex items-center gap-2">
                            <span className="flex-1 truncate">
                              {it.quantity > 1 && <span className="text-muted-foreground">{it.quantity}× </span>}
                              {it.name || "Item"}
                              <span className="text-xs text-muted-foreground"> · {it.memberIds.map((id) => byId.get(id)?.name.split(" ")[0] ?? "?").join(", ")}</span>
                            </span>
                            <span className="money">{formatINR(it.total)}</span>
                          </li>
                        ))}
                        {e.bill.charges.map((c) => (
                          <li key={c.id} className="flex items-center gap-2 text-muted-foreground">
                            <span className="flex-1 truncate">{c.label}</span>
                            <span className="money">{c.kind === "discount" ? "−" : "+"}{formatINR(c.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(e.shares).map(([id, s]) => (
                        <li key={id} className="flex items-center gap-2 text-sm">
                          <MemberAvatar member={byId.get(id)} size="sm" />
                          <span className="flex-1">{byId.get(id)?.name ?? "Removed member"}</span>
                          <span className="money font-semibold">{formatINR(s)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(e)}><Pencil /> Edit</Button>
                      <Button size="sm" variant="ghost" className="text-negative hover:text-negative" onClick={() => remove(e)}><Trash2 /> Delete</Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ExpenseDialog expense={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} />
    </>
  );
}
