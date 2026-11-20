import { useRef, useState } from "react";
import { Camera, Download, FileImage, Loader2, PencilLine, Plus, ScanLine, Sparkles, Trash2, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import sampleReceipt from "@/assets/sample-receipt.jpg.asset.json";
import { computeItemizedSplit, formatINR, signedCharge, splitEqually, sumShares, toPaise } from "@/lib/splitmate/calc";
import { scanBill, type ScannedBill } from "@/lib/splitmate/bill-scan.functions";
import { CHARGE_KINDS, draftToBill, imageToDataUrl, newCharge, newItem, scannedToDraft, type BillDraft, type DraftCharge, type DraftItem } from "@/lib/splitmate/bill-draft";
import type { ChargeKind, Member } from "@/lib/splitmate/types";
import { MemberAvatar } from "./bits";

interface Props {
  members: Member[];
  draft: BillDraft;
  setDraft: (fn: (d: BillDraft) => BillDraft) => void;
  /** The bill total from the Amount field, in paise. */
  billTotal: number;
  onScanned: (bill: ScannedBill) => void;
}

const fmtMoney = (v: number) => String(Math.round(v * 100) / 100);

export function BillSplitEditor({ members, draft, setDraft, billTotal, onScanned }: Props) {
  const scan = useServerFn(scanBill);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const started = draft.items.length > 0 || draft.charges.length > 0;

  const runScan = async (file: Blob) => {
    setScanError(null);
    setScanning(true);
    try {
      const image = await imageToDataUrl(file);
      setPreview(image);
      const res = await scan({ data: { image } });
      if (!res.ok) { setScanError(res.error); return; }
      if (res.bill.items.length === 0) { setScanError("No items found on this bill. Add them below by hand."); return; }
      setDraft(() => scannedToDraft(res.bill));
      onScanned(res.bill);
      toast.success(`Read ${res.bill.items.length} items from the bill`, { description: "Check them, then tap who had what." });
    } catch (e) {
      setScanError(e instanceof Error && e.message ? e.message : "Couldn't read this bill. Enter items manually.");
    } finally {
      setScanning(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void runScan(f);
  };

  const trySample = async () => {
    try {
      const blob = await (await fetch(sampleReceipt.url)).blob();
      await runScan(blob);
    } catch {
      setScanError("Couldn't load the sample bill.");
    }
  };

  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const updateCharge = (id: string, patch: Partial<DraftCharge>) =>
    setDraft((d) => ({ ...d, charges: d.charges.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const setItemMembers = (item: DraftItem, memberIds: string[]) => {
    const customShares = item.splitMode === "custom"
      ? Object.fromEntries(memberIds.map((id) => [id, item.customShares[id] ?? "0"]))
      : undefined;
    updateItem(item.id, { memberIds, ...(customShares ? { customShares } : {}) });
  };

  const setItemSplitMode = (item: DraftItem, splitMode: DraftItem["splitMode"]) => {
    if (item.splitMode === splitMode) return;
    if (splitMode === "custom") {
      const equalShares = splitEqually(toPaise(item.total || 0), item.memberIds);
      updateItem(item.id, {
        splitMode,
        customShares: Object.fromEntries(Object.entries(equalShares).map(([id, amount]) => [id, fmtMoney(amount / 100)])),
      });
    } else {
      updateItem(item.id, { splitMode });
    }
  };

  /** Editing qty or unit price recalculates the line total. */
  const setQtyOrPrice = (it: DraftItem, patch: { qty?: string; unitPrice?: string }) => {
    const next = { ...it, ...patch };
    const q = Number(next.qty);
    const u = Number(next.unitPrice);
    updateItem(it.id, { ...patch, ...(q > 0 && u >= 0 && next.unitPrice !== "" ? { total: fmtMoney(q * u) } : {}) });
  };

  const bill = draftToBill(draft);
  const split = computeItemizedSplit(bill);
  const diff = billTotal - split.total;
  const unassigned = bill.items.filter((i) => i.memberIds.length === 0).length;
  const byId = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="grid gap-4">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-label="Take a photo of the bill" />
      <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} aria-label="Upload a bill photo" />

      {/* Scan area */}
      <div className="rounded-xl border border-dashed bg-muted/50 p-3">
        <div className="flex items-start gap-3">
          {preview ? (
            <img src={preview} alt="Bill photo" className="h-20 w-16 shrink-0 rounded-lg border object-cover" />
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight text-highlight-foreground">
              <ScanLine className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{scanning ? "Reading your bill…" : preview ? "Scan another bill" : "Scan the bill"}</p>
            <p className="text-xs text-muted-foreground">
              {scanning ? "This takes a few seconds." : "Snap or upload the bill and we'll list the items. You can fix anything it gets wrong."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="highlight" disabled={scanning} onClick={() => cameraRef.current?.click()}>
                {scanning ? <Loader2 className="animate-spin" /> : <Camera />} Take photo
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={scanning} onClick={() => uploadRef.current?.click()}>
                <FileImage /> Upload
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={scanning} onClick={trySample}>
                <Sparkles /> Try sample bill
              </Button>
              {!started && (
                <Button type="button" size="sm" variant="ghost" disabled={scanning} onClick={() => setDraft((d) => ({ ...d, items: [newItem()] }))}>
                  <PencilLine /> Enter manually
                </Button>
              )}
            </div>
            {scanError && <p role="alert" className="mt-2 rounded-lg bg-negative-soft px-2.5 py-1.5 text-xs font-medium text-negative">{scanError}</p>}
          </div>
        </div>
      </div>

      {started && (
        <>
          {/* Items */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Items <span className="font-normal text-muted-foreground">· tap who had each one</span></Label>
              {unassigned > 0 && <span className="text-xs font-semibold text-negative">{unassigned} unassigned</span>}
            </div>
            <ul className="grid gap-2">
              {draft.items.map((it, idx) => {
                const totalP = toPaise(it.total || 0);
                const each = it.splitMode !== "custom" && it.memberIds.length > 1 ? splitEqually(totalP, it.memberIds) : null;
                const customShares = Object.fromEntries(it.memberIds.map((id) => [id, toPaise(it.customShares[id] || 0)]));
                const customAllocated = sumShares(customShares);
                const customRemaining = totalP - customAllocated;
                const q = Number(it.qty);
                const mismatch = q > 0 && it.unitPrice !== "" && toPaise(q * Number(it.unitPrice)) !== totalP;
                return (
                  <li key={it.id} className={cn("rounded-xl border bg-card p-2.5", it.memberIds.length === 0 && "border-negative/40")}>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Input aria-label={`Item ${idx + 1} name`} placeholder="Item name" value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} className="h-8 font-medium" />
                      <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-negative" aria-label={`Remove ${it.name || "item"}`}
                        onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((x) => x.id !== it.id) }))}>
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <MoneyField label="Qty" plain value={it.qty} onChange={(v) => setQtyOrPrice(it, { qty: v })} />
                      <MoneyField label="Unit price" value={it.unitPrice} onChange={(v) => setQtyOrPrice(it, { unitPrice: v })} />
                      <MoneyField label="Total" value={it.total} onChange={(v) => updateItem(it.id, { total: v })} strong />
                    </div>
                    {mismatch && <p className="mt-1 text-[11px] text-muted-foreground">Qty × unit price is {formatINR(toPaise(q * Number(it.unitPrice)))} — the total is used.</p>}
                    <MemberChips
                      members={members}
                      selected={it.memberIds}
                      onChange={(ids) => setItemMembers(it, ids)}
                      allLabel="All"
                      itemName={it.name || `item ${idx + 1}`}
                    />
                    <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="group" aria-label={`Split ${it.name || `item ${idx + 1}`} equally or custom`}>
                      {(["equal", "custom"] as const).map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-pressed={it.splitMode === mode}
                          onClick={() => setItemSplitMode(it, mode)}
                          className={cn("w-full", it.splitMode === mode && "bg-card text-foreground shadow-card")}
                        >
                          {mode === "equal" ? "Equal" : "Custom"}
                        </Button>
                      ))}
                    </div>
                    {it.splitMode === "custom" && (
                      <div className="mt-2 grid gap-1.5 rounded-xl border bg-background/60 p-2">
                        {it.memberIds.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Select members above to enter their amounts.</p>
                        ) : (
                          <>
                            <ul className="grid gap-1.5">
                              {it.memberIds.map((id) => {
                                const memberName = byId.get(id)?.name ?? "Removed member";
                                return (
                                  <li key={id} className="flex items-center gap-2">
                                    <MemberAvatar member={byId.get(id)} size="sm" />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{memberName}</span>
                                    <div className="relative w-28 shrink-0">
                                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                                      <Input
                                        aria-label={`${memberName}'s amount for ${it.name || `item ${idx + 1}`}`}
                                        inputMode="decimal"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={it.customShares[id] ?? "0"}
                                        onChange={(e) => updateItem(it.id, { customShares: { ...it.customShares, [id]: e.target.value } })}
                                        className="money h-8 pl-5 text-right"
                                      />
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            <div
                              role="status"
                              className={cn("flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-xs", customRemaining === 0 ? "text-positive" : "text-negative")}
                            >
                              <span>Allocated {formatINR(customAllocated)}</span>
                              <span className="font-semibold">
                                {customRemaining === 0 ? "Fully allocated" : customRemaining > 0 ? `${formatINR(customRemaining)} remaining` : `${formatINR(-customRemaining)} over`}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {each && <p className="mt-1.5 text-[11px] text-muted-foreground">Shared {it.memberIds.length} ways · {formatINR(Object.values(each)[0] ?? 0)} each</p>}
                  </li>
                );
              })}
            </ul>
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setDraft((d) => ({ ...d, items: [...d.items, newItem()] }))}>
              <Plus /> Add item
            </Button>
          </div>

          {/* Charges */}
          <div className="grid gap-2">
            <Label>Tax, delivery &amp; discounts</Label>
            {draft.charges.length === 0 && <p className="text-xs text-muted-foreground">No extra charges. Add GST, service charge, delivery or a discount if the bill has one.</p>}
            <ul className="grid gap-2">
              {draft.charges.map((c) => (
                <li key={c.id} className="rounded-xl border bg-card p-2.5">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input aria-label="Charge name" value={c.label} onChange={(e) => updateCharge(c.id, { label: e.target.value })} className="h-8 font-medium" />
                    <Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-negative" aria-label={`Remove ${c.label || "charge"}`}
                      onClick={() => setDraft((d) => ({ ...d, charges: d.charges.filter((x) => x.id !== c.id) }))}>
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="grid gap-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Type</span>
                      <Select value={c.kind} onValueChange={(v) => updateCharge(c.id, { kind: v as ChargeKind })}>
                        <SelectTrigger className="h-8" aria-label="Charge type"><SelectValue /></SelectTrigger>
                        <SelectContent>{CHARGE_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <MoneyField label={c.kind === "discount" ? "Amount off" : "Amount"} value={c.amount} onChange={(v) => updateCharge(c.id, { amount: v })} strong />
                    <div className="grid gap-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Split</span>
                      <Select value={c.split} onValueChange={(v) => updateCharge(c.id, { split: v as DraftCharge["split"] })}>
                        <SelectTrigger className="h-8" aria-label="How to split this charge"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proportional">By items</SelectItem>
                          <SelectItem value="equal">Equally</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <MemberChips members={members} selected={c.memberIds} onChange={(ids) => updateCharge(c.id, { memberIds: ids })} allLabel="Everyone on bill" itemName={c.label || "charge"} />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5">
              {(["tax", "service", "delivery", "discount"] as const).map((k) => (
                <Button key={k} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDraft((d) => ({ ...d, charges: [...d.charges, newCharge(k)] }))}>
                  <Plus /> {CHARGE_KINDS.find((x) => x.id === k)?.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="grid gap-3 rounded-xl bg-muted p-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Items total</dt>
              <dd className="money text-right font-semibold">{formatINR(split.itemsTotal)}</dd>
              <dt className="text-muted-foreground">Charges &amp; discounts</dt>
              <dd className="money text-right font-semibold">{split.chargesTotal < 0 ? "−" : "+"}{formatINR(Math.abs(split.chargesTotal))}</dd>
              <dt className="text-muted-foreground">Items + charges</dt>
              <dd className="money text-right font-semibold">{formatINR(split.total)}</dd>
              <dt className="font-semibold">Bill total</dt>
              <dd className="money text-right font-display text-base font-bold">{billTotal > 0 ? formatINR(billTotal) : "—"}</dd>
            </dl>
            <div
              role="status"
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold",
                billTotal > 0 && diff === 0 ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative",
              )}
            >
              {billTotal <= 0
                ? "Enter the bill total in the Amount field above"
                : diff === 0
                  ? "Matches the bill total ✓"
                  : diff > 0
                    ? `${formatINR(diff)} missing — an item or charge may be missing or misread`
                    : `${formatINR(-diff)} more than the bill total — check prices or discounts`}
            </div>
            {Object.keys(split.perMember).length > 0 && (
              <ul className="grid gap-1.5">
                {Object.entries(split.perMember)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([id, r]) => (
                    <li key={id} className="flex items-center gap-2 text-sm">
                      <MemberAvatar member={byId.get(id)} size="sm" />
                      <span className="flex-1 font-medium">{byId.get(id)?.name ?? "Removed member"}</span>
                      <span className="money hidden text-xs text-muted-foreground sm:inline">
                        {formatINR(r.items)} items {r.charges < 0 ? "−" : "+"} {formatINR(Math.abs(r.charges))}
                      </span>
                      <span className="money w-24 text-right font-semibold">{formatINR(r.total)}</span>
                    </li>
                  ))}
              </ul>
            )}
            {bill.charges.some((c) => signedCharge(c) !== 0 && c.split === "proportional") && (
              <p className="text-[11px] text-muted-foreground">"By items" charges are shared in proportion to what each person ordered.</p>
            )}
          </div>
        </>
      )}

      {!started && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Download className="size-3.5" /> No bill handy?{" "}
          <a href={sampleReceipt.url} download="sample-receipt.jpg" className="font-semibold text-foreground underline underline-offset-2">Download the sample bill</a>
        </p>
      )}
    </div>
  );
}

function MoneyField({ label, value, onChange, strong, plain }: { label: string; value: string; onChange: (v: string) => void; strong?: boolean; plain?: boolean }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        {!plain && <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>}
        <Input
          aria-label={label}
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("money h-8 text-right", !plain && "pl-5", strong && "font-semibold")}
        />
      </div>
    </label>
  );
}

function MemberChips({ members, selected, onChange, allLabel, itemName }: { members: Member[]; selected: string[]; onChange: (ids: string[]) => void; allLabel: string; itemName: string }) {
  const everyone = allLabel === "All";
  const allOn = everyone ? members.length > 0 && selected.length === members.length : selected.length === 0;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Who shares ${itemName}`}>
      <button
        type="button"
        aria-pressed={allOn}
        onClick={() => onChange(everyone ? (allOn ? [] : members.map((m) => m.id)) : [])}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
          allOn ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        <Users className="size-3" /> {allLabel}
      </button>
      {members.map((m) => {
        const on = selected.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            aria-label={`${m.name} shares ${itemName}`}
            onClick={() => onChange(on ? selected.filter((x) => x !== m.id) : [...selected, m.id])}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs font-semibold transition-colors",
              on ? "border-highlight bg-highlight text-highlight-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <MemberAvatar member={m} size="sm" className="size-5 text-[9px] ring-0" />
            {m.name.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}
