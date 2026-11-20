import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { BalanceAmount, BalancePill, EmptyState, formatDate, MemberAvatar, PageHeader, Panel, PanelTitle } from "@/components/splitmate/bits";
import { CATEGORIES, getCategory } from "@/lib/splitmate/categories";
import { formatINR } from "@/lib/splitmate/calc";
import { useGroupStats } from "@/lib/splitmate/use-group-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · SplitMate" },
      { name: "description", content: "See your group's total spend, every member's balance and who owes whom at a glance." },
      { property: "og:title", content: "SplitMate Dashboard" },
      { property: "og:description", content: "Group totals, member balances and pending settlements in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { group, members, expenses, balances, settlements, total, byId, outstanding } = useGroupStats();

  if (!group) {
    return (
      <EmptyState emoji="🧾" title="No groups yet">
        <Link to="/groups" className="font-semibold text-foreground underline">Create your first group</Link> to start splitting.
      </EmptyState>
    );
  }

  const perHead = members.length ? Math.round(total / members.length) : 0;
  const top = [...balances].sort((a, b) => b.paid - a.paid)[0];
  const topMember = top ? byId.get(top.memberId) : undefined;
  const maxAbs = Math.max(1, ...balances.map((b) => Math.abs(b.net)));

  const catData = CATEGORIES.map((c) => ({
    name: c.label,
    value: expenses.filter((e) => e.category === c.id).reduce((a, e) => a + e.amount, 0),
    color: c.chart,
  })).filter((d) => d.value > 0);

  return (
    <>
      <PageHeader
        eyebrow={`${group.emoji} Dashboard`}
        title={<>Hey squad, here&rsquo;s the <span className="marker">damage</span>.</>}
        description={group.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/settle">Settle up <ArrowRight /></Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Total spent" value={formatINR(total)} hint={`${expenses.length} expenses`} featured />
        <StatCard icon={Users} label="Per head" value={formatINR(perHead)} hint={`${members.length} members`} />
        <StatCard icon={Receipt} label="To settle" value={formatINR(outstanding)} hint={`${settlements.length} payment${settlements.length === 1 ? "" : "s"} needed`} />
        <StatCard icon={TrendingUp} label="Top spender" value={topMember?.name ?? "—"} hint={top ? `paid ${formatINR(top.paid)}` : ""} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelTitle action={<Link to="/members" className="text-xs font-semibold text-muted-foreground hover:text-foreground">Manage</Link>}>
            Balances
          </PanelTitle>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {balances.map((b) => {
                const m = byId.get(b.memberId);
                return (
                  <li key={b.memberId} className="rounded-xl border bg-background/60 p-4">
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={m} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{m?.name}</p>
                        <BalancePill value={b.net} />
                      </div>
                      <BalanceAmount value={b.net} className="text-lg" />
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", b.net >= 0 ? "bg-positive" : "bg-negative")}
                        style={{ width: `${(Math.abs(b.net) / maxAbs) * 100}%` }}
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Paid</dt>
                        <dd className="money font-semibold">{formatINR(b.paid)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Share</dt>
                        <dd className="money font-semibold">{formatINR(b.share)}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelTitle>Where it went</PanelTitle>
          {catData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spending yet.</p>
          ) : (
            <>
              <div className="relative h-48 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={2} stroke="none">
                      {catData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatINR(v)}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="money font-display text-xl font-extrabold">{formatINR(total)}</span>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {catData.map((d) => (
                  <li key={d.name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1 text-muted-foreground">{d.name}</span>
                    <span className="money font-semibold">{formatINR(d.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelTitle action={<Link to="/expenses" className="text-xs font-semibold text-muted-foreground hover:text-foreground">See all</Link>}>
            Recent expenses
          </PanelTitle>
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing recorded yet — tap “Add expense”.</p>
          ) : (
            <ul className="divide-y">
              {expenses.slice(0, 5).map((e) => {
                const cat = getCategory(e.category);
                return (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                      <cat.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {byId.get(e.paidBy)?.name} paid · {formatDate(e.date)}
                      </p>
                    </div>
                    <span className="money font-semibold">{formatINR(e.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelTitle>Quick settle</PanelTitle>
          {settlements.length === 0 ? (
            <div className="rounded-xl bg-positive-soft p-4 text-sm font-semibold text-positive">All square! 🎉 Nobody owes anything.</div>
          ) : (
            <ul className="space-y-2">
              {settlements.slice(0, 4).map((t, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border bg-background/60 p-3 text-sm">
                  <MemberAvatar member={byId.get(t.from)} size="sm" />
                  <span className="font-semibold">{byId.get(t.from)?.name}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <MemberAvatar member={byId.get(t.to)} size="sm" />
                  <span className="font-semibold">{byId.get(t.to)?.name}</span>
                  <span className="money ml-auto font-bold text-negative">{formatINR(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="default" className="mt-4 w-full">
            <Link to="/settle">Open settle up</Link>
          </Button>
        </Panel>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  featured,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-28 min-w-0 overflow-hidden rounded-2xl border p-4 sm:p-5",
        featured ? "border-2 border-primary bg-highlight text-highlight-foreground shadow-pop" : "bg-card shadow-card",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-bold uppercase tracking-wider", featured ? "opacity-80" : "text-muted-foreground")}>{label}</span>
        <Icon className="size-4 opacity-70" />
      </div>
      <p className="money mt-3 truncate font-display text-2xl font-extrabold sm:text-3xl">{value}</p>
      <p className={cn("mt-1 text-xs", featured ? "opacity-80" : "text-muted-foreground")}>{hint}</p>
    </div>
  );
}
