import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Check, Copy, QrCode, Smartphone, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BalanceAmount, EmptyState, formatDate, MemberAvatar, PageHeader, Panel, PanelTitle } from "@/components/splitmate/bits";
import { buildUpiLink, formatINR, isValidUpiId } from "@/lib/splitmate/calc";
import { todayISO, uid } from "@/lib/splitmate/store";
import { useGroupStats } from "@/lib/splitmate/use-group-stats";
import type { Transfer } from "@/lib/splitmate/types";

export const Route = createFileRoute("/settle")({
  head: () => ({
    meta: [
      { title: "Settle up · SplitMate" },
      { name: "description", content: "Clear every balance in your group with the fewest possible UPI payments." },
      { property: "og:title", content: "Settle up with UPI · SplitMate" },
      { property: "og:description", content: "Minimum-transaction settlements with one-tap UPI payment links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettlePage,
});

function SettlePage() {
  const { group, settlements, debts, byId, payments, dispatch, balances } = useGroupStats();
  const [qr, setQr] = useState<{ t: Transfer; link: string } | null>(null);

  if (!group) return <EmptyState emoji="📂" title="Pick or create a group first" />;

  const linkFor = (t: Transfer) => {
    const payee = byId.get(t.to);
    if (!payee?.upiId || !isValidUpiId(payee.upiId) || t.amount <= 0) return null;
    const payer = byId.get(t.from);
    return buildUpiLink({
      upiId: payee.upiId,
      payeeName: payee.name,
      amount: t.amount,
      note: `SplitMate ${group.name} - ${payer?.name ?? "Settle up"} to ${payee.name}`,
    });
  };

  const markPaid = (t: Transfer) => {
    const id = uid("pay");
    dispatch({ type: "addPayment", payment: { id, groupId: group.id, from: t.from, to: t.to, amount: t.amount, date: todayISO() } });
    toast.success(`${byId.get(t.from)?.name} paid ${byId.get(t.to)?.name} ${formatINR(t.amount)}`, {
      action: { label: "Undo", onClick: () => dispatch({ type: "deletePayment", id }) },
    });
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("UPI link copied");
    } catch {
      toast.error("Couldn't copy — long-press the link instead");
    }
  };

  const saved = debts.length - settlements.length;

  return (
    <>
      <PageHeader
        eyebrow="Settle up"
        title={<>Fewest payments, <span className="marker">zero drama</span>.</>}
        description="We crunch every expense and find the smallest set of payments that squares everyone up."
      />

      {settlements.length > 0 && saved > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-primary bg-highlight p-4 text-highlight-foreground shadow-pop">
          <Sparkles className="size-5 shrink-0" />
          <p className="text-sm font-semibold">
            {debts.length} separate debts simplified to just {settlements.length} payment{settlements.length === 1 ? "" : "s"} — {saved} fewer UPI transfers.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Panel>
            <PanelTitle>Suggested payments</PanelTitle>
            {settlements.length === 0 ? (
              <div className="rounded-xl bg-positive-soft p-6 text-center">
                <p className="text-3xl">🎉</p>
                <p className="mt-2 font-display text-lg font-bold text-positive">Everyone is settled up</p>
                <p className="text-sm text-muted-foreground">No one owes anything in {group.name}.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {settlements.map((t) => {
                  const from = byId.get(t.from);
                  const to = byId.get(t.to);
                  const link = linkFor(t);
                  return (
                    <li key={`${t.from}-${t.to}`} className="rounded-2xl border bg-background/60 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <MemberAvatar member={from} />
                          <div className="leading-tight">
                            <p className="font-semibold">{from?.name}</p>
                            <p className="text-xs text-muted-foreground">pays</p>
                          </div>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                          <MemberAvatar member={to} />
                          <div className="leading-tight">
                            <p className="font-semibold">{to?.name}</p>
                            <p className="text-xs text-muted-foreground">{to?.upiId || "no UPI ID"}</p>
                          </div>
                        </div>
                        <span className="money ml-auto font-display text-2xl font-extrabold text-negative">{formatINR(t.amount)}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {link ? (
                          <>
                            <Button asChild size="sm" variant="highlight">
                              <a href={link}><Smartphone /> Pay via UPI</a>
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setQr({ t, link })}><QrCode /> QR</Button>
                            <Button size="sm" variant="outline" onClick={() => copy(link)}><Copy /> Copy link</Button>
                          </>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/members">Add {to?.name}&rsquo;s UPI ID</Link>
                          </Button>
                        )}
                        <Button size="sm" variant="positive" className="sm:ml-auto" onClick={() => markPaid(t)}><Check /> Mark as paid</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel className="mt-6">
            <PanelTitle>Settle-up history</PanelTitle>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {[...payments].reverse().map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="flex size-8 items-center justify-center rounded-full bg-positive-soft text-positive"><Check className="size-4" /></span>
                    <span className="flex-1">
                      <span className="font-semibold">{byId.get(p.from)?.name}</span> paid <span className="font-semibold">{byId.get(p.to)?.name}</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(p.date)}</span>
                    </span>
                    <span className="money font-semibold text-positive">{formatINR(p.amount)}</span>
                    <Button size="icon" variant="ghost" aria-label="Undo payment" onClick={() => dispatch({ type: "deletePayment", id: p.id })}>
                      <Undo2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Panel>
            <PanelTitle>Net balances</PanelTitle>
            <ul className="space-y-2">
              {[...balances].sort((a, b) => b.net - a.net).map((b) => (
                <li key={b.memberId} className="flex items-center gap-3 text-sm">
                  <MemberAvatar member={byId.get(b.memberId)} size="sm" />
                  <span className="flex-1 font-medium">{byId.get(b.memberId)?.name}</span>
                  <BalanceAmount value={b.net} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelTitle>Who owes whom</PanelTitle>
            <p className="-mt-2 mb-3 text-xs text-muted-foreground">Direct debts from who paid for whom, before simplifying.</p>
            {debts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody owes anybody.</p>
            ) : (
              <ul className="space-y-1.5">
                {debts.map((d) => (
                  <li key={`${d.from}-${d.to}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm odd:bg-muted/60">
                    <span className="font-medium">{byId.get(d.from)?.name}</span>
                    <span className="text-xs text-muted-foreground">owes</span>
                    <span className="font-medium">{byId.get(d.to)?.name}</span>
                    <span className="money ml-auto font-semibold text-negative">{formatINR(d.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Scan to pay {qr && byId.get(qr.t.to)?.name}</DialogTitle>
            <DialogDescription>Open GPay, PhonePe, Paytm or any UPI app and scan.</DialogDescription>
          </DialogHeader>
          {qr && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl border-2 border-primary bg-card p-4 shadow-pop">
                <QRCodeSVG value={qr.link} size={208} bgColor="transparent" fgColor="currentColor" className="text-foreground" />
              </div>
              <p className="money font-display text-3xl font-extrabold">{formatINR(qr.t.amount)}</p>
              <p className="text-xs text-muted-foreground">{byId.get(qr.t.to)?.upiId}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
