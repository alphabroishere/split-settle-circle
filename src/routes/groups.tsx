import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar, PageHeader } from "@/components/splitmate/bits";
import { formatINR } from "@/lib/splitmate/calc";
import { todayISO, uid, useStore } from "@/lib/splitmate/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: "Groups · SplitMate" },
      { name: "description", content: "Create expense groups for your hostel room, flat, trips and clubs." },
      { property: "og:title", content: "Expense groups · SplitMate" },
      { property: "og:description", content: "One group per room, trip or club — switch between them anytime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

const EMOJIS = ["🛏️", "🏖️", "📚", "🍕", "🏔️", "🎮", "🎉", "🚌", "🏏", "🎸"];

function GroupsPage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        eyebrow="Groups"
        title="Your groups."
        description="Hostel room, flat, Goa trip, fest committee — keep each one's money separate."
        actions={
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline"><RotateCcw /> Reset sample data</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset to sample data?</AlertDialogTitle>
                  <AlertDialogDescription>This replaces all your groups, expenses and payments with the demo data.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { dispatch({ type: "reset" }); toast.success("Sample data restored"); }}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <NewGroupDialog />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.groups.map((g) => {
          const members = state.members.filter((m) => m.groupId === g.id);
          const exps = state.expenses.filter((e) => e.groupId === g.id);
          const total = exps.reduce((a, e) => a + e.amount, 0);
          const active = g.id === state.activeGroupId;
          return (
            <article
              key={g.id}
              className={cn(
                "group relative flex flex-col rounded-2xl border bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5",
                active && "border-2 border-primary shadow-pop",
              )}
            >
              <div className="flex items-start justify-between">
                <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-2xl">{g.emoji}</span>
                {active && <span className="rounded-full bg-highlight px-2.5 py-0.5 text-xs font-bold text-highlight-foreground">Active</span>}
              </div>
              <h2 className="mt-4 font-display text-xl font-bold">{g.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description || "No description"}</p>
              <div className="mt-4 flex -space-x-2">
                {members.slice(0, 6).map((m) => <MemberAvatar key={m.id} member={m} size="sm" />)}
              </div>
              <div className="mt-4 flex items-end justify-between border-t pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">{exps.length} expenses</p>
                  <p className="money font-display text-xl font-extrabold">{formatINR(total)}</p>
                </div>
                <div className="flex gap-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${g.name}`} className="text-negative hover:text-negative"><Trash2 /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {g.name}?</AlertDialogTitle>
                        <AlertDialogDescription>Its members, expenses and payments will be removed. This can't be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => dispatch({ type: "deleteGroup", id: g.id })}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => {
                      dispatch({ type: "setActiveGroup", id: g.id });
                      navigate({ to: "/" });
                    }}
                  >
                    Open
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function NewGroupDialog() {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]!);
  const [desc, setDesc] = useState("");
  const [people, setPeople] = useState("");

  const create = () => {
    if (!name.trim()) { toast.error("Give your group a name"); return; }
    const id = uid("grp");
    const names = [...new Set(people.split(",").map((s) => s.trim()).filter(Boolean))];
    dispatch({
      type: "addGroup",
      group: { id, name: name.trim(), emoji, description: desc.trim(), createdAt: todayISO() },
      members: names.map((n, i) => ({ id: uid("mem"), groupId: id, name: n, upiId: "", color: i % 6 })),
    });
    toast.success(`${emoji} ${name.trim()} created`);
    setOpen(false);
    setName("");
    setDesc("");
    setPeople("");
    navigate({ to: names.length ? "/" : "/members" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="highlight"><Plus /> New group</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New group</DialogTitle>
          <DialogDescription>You can add more members and UPI IDs later.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`Use ${e}`}
                  onClick={() => setEmoji(e)}
                  className={cn("flex size-10 items-center justify-center rounded-xl border text-xl transition-colors", emoji === e ? "border-2 border-primary bg-highlight" : "bg-card hover:bg-accent")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-name">Group name</Label>
            <Input id="g-name" placeholder="e.g. Manali Winter Trip" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea id="g-desc" rows={2} placeholder="What's this group for?" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-people">Members</Label>
            <Input id="g-people" placeholder="Aarav, Priya, Rohan" value={people} onChange={(e) => setPeople(e.target.value)} />
            <p className="text-xs text-muted-foreground">Separate names with commas.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="highlight" onClick={create}>Create group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
