import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BalanceAmount, BalancePill, EmptyState, MemberAvatar, PageHeader, Panel, PanelTitle } from "@/components/splitmate/bits";
import { formatINR, isValidUpiId } from "@/lib/splitmate/calc";
import { uid } from "@/lib/splitmate/store";
import { useGroupStats } from "@/lib/splitmate/use-group-stats";
import type { Member } from "@/lib/splitmate/types";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Members · SplitMate" },
      { name: "description", content: "Add roommates and friends to your group and save their UPI IDs for quick settle-ups." },
      { property: "og:title", content: "Group members · SplitMate" },
      { property: "og:description", content: "Manage who's in the group and what each person paid, owes and gets back." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { group, members, balances, expenses, payments, dispatch } = useGroupStats();
  const [name, setName] = useState("");
  const [upi, setUpi] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!group) return <EmptyState emoji="📂" title="Pick or create a group first" />;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { toast.error("Enter a name"); return; }
    if (members.some((m) => m.name.toLowerCase() === n.toLowerCase())) { toast.error(`${n} is already in this group`); return; }
    if (upi && !isValidUpiId(upi)) { toast.error("That UPI ID doesn't look right (e.g. name@okaxis)"); return; }
    dispatch({ type: "addMember", member: { id: uid("mem"), groupId: group.id, name: n, upiId: upi.trim(), color: members.length % 6 } });
    toast.success(`${n} joined ${group.name}`);
    setName("");
    setUpi("");
  };

  const remove = (m: Member) => {
    const involved =
      expenses.some((e) => e.paidBy === m.id || m.id in e.shares) || payments.some((p) => p.from === m.id || p.to === m.id);
    if (involved) { toast.error(`${m.name} is part of existing expenses`, { description: "Delete or edit those expenses first." }); return; }
    dispatch({ type: "removeMember", id: m.id });
    toast(`${m.name} removed`);
  };

  return (
    <>
      <PageHeader eyebrow="Members" title="The squad." description={`${members.length} people in ${group.emoji} ${group.name}`} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {members.length === 0 && <EmptyState emoji="👋" title="No members yet">Add your roommates or trip buddies.</EmptyState>}
          {members.map((m) => {
            const b = balances.find((x) => x.memberId === m.id);
            return editingId === m.id ? (
              <EditRow key={m.id} member={m} onDone={() => setEditingId(null)} />
            ) : (
              <div key={m.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-card">
                <MemberAvatar member={m} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.upiId || "No UPI ID yet"}</p>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-right text-xs">
                  <div>
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="money text-sm font-semibold">{formatINR(b?.paid ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Share</dt>
                    <dd className="money text-sm font-semibold">{formatINR(b?.share ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground"><BalancePill value={b?.net ?? 0} /></dt>
                    <dd className="mt-0.5 text-sm"><BalanceAmount value={b?.net ?? 0} /></dd>
                  </div>
                </dl>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${m.name}`} onClick={() => setEditingId(m.id)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${m.name}`} className="text-negative hover:text-negative" onClick={() => remove(m)}><Trash2 /></Button>
                </div>
              </div>
            );
          })}
        </div>

        <Panel className="h-fit">
          <PanelTitle>Add a member</PanelTitle>
          <form onSubmit={add} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="mem-name">Name</Label>
              <Input id="mem-name" placeholder="e.g. Tanvi" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mem-upi">UPI ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="mem-upi" placeholder="tanvi@okaxis" value={upi} onChange={(e) => setUpi(e.target.value)} />
            </div>
            <Button type="submit" variant="highlight" className="mt-1"><UserPlus /> Add to group</Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">UPI IDs are used to create one-tap payment links when settling up.</p>
        </Panel>
      </div>
    </>
  );
}

function EditRow({ member, onDone }: { member: Member; onDone: () => void }) {
  const { dispatch } = useGroupStats();
  const [name, setName] = useState(member.name);
  const [upi, setUpi] = useState(member.upiId);
  const save = () => {
    if (!name.trim()) { toast.error("Name can't be empty"); return; }
    if (upi && !isValidUpiId(upi)) { toast.error("That UPI ID doesn't look right"); return; }
    dispatch({ type: "updateMember", member: { ...member, name: name.trim(), upiId: upi.trim() } });
    onDone();
  };
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border-2 border-primary bg-card p-4 shadow-pop">
      <MemberAvatar member={member} size="lg" />
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor={`n-${member.id}`}>Name</Label>
        <Input id={`n-${member.id}`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor={`u-${member.id}`}>UPI ID</Label>
        <Input id={`u-${member.id}`} value={upi} placeholder="name@bank" onChange={(e) => setUpi(e.target.value)} />
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="positive" aria-label="Save" onClick={save}><Check /></Button>
        <Button size="icon" variant="ghost" aria-label="Cancel" onClick={onDone}><X /></Button>
      </div>
    </div>
  );
}
