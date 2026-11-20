import { toPaise } from "./calc";
import type { ScannedBill } from "./bill-scan.functions";
import { uid } from "./store";
import type { BillCharge, ChargeKind, ItemizedBill } from "./types";

/** Form-state version of an itemized bill: money fields stay as typed strings. */
export interface DraftItem {
  id: string;
  name: string;
  qty: string;
  unitPrice: string;
  total: string;
  memberIds: string[];
  splitMode: "equal" | "custom";
  customShares: Record<string, string>;
}
export interface DraftCharge { id: string; label: string; kind: ChargeKind; amount: string; split: BillCharge["split"]; memberIds: string[] }
export interface BillDraft { merchant: string; items: DraftItem[]; charges: DraftCharge[] }

export const emptyDraft = (): BillDraft => ({ merchant: "", items: [], charges: [] });

const rupees = (p: number) => String(Math.round(p) / 100);
const num = (v: number) => String(Math.round(v * 100) / 100);

export const CHARGE_KINDS: { id: ChargeKind; label: string; split: BillCharge["split"] }[] = [
  { id: "tax", label: "Tax / GST", split: "proportional" },
  { id: "service", label: "Service charge", split: "proportional" },
  { id: "delivery", label: "Delivery", split: "equal" },
  { id: "packaging", label: "Packaging", split: "equal" },
  { id: "tip", label: "Tip", split: "equal" },
  { id: "discount", label: "Discount", split: "proportional" },
  { id: "other", label: "Other", split: "equal" },
];

export const newItem = (memberIds: string[] = []): DraftItem => ({
  id: uid("item"), name: "", qty: "1", unitPrice: "", total: "", memberIds,
  splitMode: "equal", customShares: {},
});
export const newCharge = (kind: ChargeKind = "tax"): DraftCharge => ({
  id: uid("chg"),
  label: CHARGE_KINDS.find((k) => k.id === kind)?.label ?? "Charge",
  kind,
  amount: "",
  split: CHARGE_KINDS.find((k) => k.id === kind)?.split ?? "equal",
  memberIds: [],
});

export function draftToBill(d: BillDraft): ItemizedBill {
  return {
    ...(d.merchant.trim() ? { merchant: d.merchant.trim() } : {}),
    items: d.items.map((i) => ({
      id: i.id,
      name: i.name.trim(),
      quantity: Number(i.qty) > 0 ? Number(i.qty) : 1,
      unitPrice: toPaise(i.unitPrice || 0),
      total: toPaise(i.total || 0),
      memberIds: i.memberIds,
      splitMode: i.splitMode,
      ...(i.splitMode === "custom"
        ? { customShares: Object.fromEntries(Object.entries(i.customShares).map(([id, amount]) => [id, toPaise(amount || 0)])) }
        : {}),
    })),
    charges: d.charges
      .map((c) => ({ id: c.id, label: c.label.trim(), kind: c.kind, amount: Math.abs(toPaise(c.amount || 0)), split: c.split, memberIds: c.memberIds }))
      .filter((c) => c.amount !== 0 || c.label),
  };
}

export function billToDraft(b: ItemizedBill): BillDraft {
  return {
    merchant: b.merchant ?? "",
    items: b.items.map((i) => ({
      id: i.id,
      name: i.name,
      qty: String(i.quantity),
      unitPrice: rupees(i.unitPrice),
      total: rupees(i.total),
      memberIds: [...i.memberIds],
      splitMode: i.splitMode ?? "equal",
      customShares: Object.fromEntries(Object.entries(i.customShares ?? {}).map(([id, amount]) => [id, rupees(amount)])),
    })),
    charges: b.charges.map((c) => ({ id: c.id, label: c.label, kind: c.kind, amount: rupees(c.amount), split: c.split, memberIds: [...c.memberIds] })),
  };
}

/** Turn the bill reader's output into editable rows. Nothing is assigned to anyone yet. */
export function scannedToDraft(s: ScannedBill): BillDraft {
  return {
    merchant: s.merchant ?? "",
    items: s.items.map((i) => {
      const qty = i.quantity > 0 ? i.quantity : 1;
      const total = i.totalPrice || i.unitPrice * qty;
      const unit = i.unitPrice || total / qty;
      return {
        id: uid("item"), name: i.name, qty: num(qty), unitPrice: num(unit), total: num(total),
        memberIds: [], splitMode: "equal", customShares: {},
      };
    }),
    charges: s.charges
      .filter((c) => c.amount !== 0)
      .map((c) => {
        // A negative round-off reduces the bill, same as a discount.
        const kind: ChargeKind = c.amount < 0 ? "discount" : c.type;
        return { ...newCharge(kind), label: c.label, amount: num(Math.abs(c.amount)) };
      }),
  };
}

/** Resize a photo in the browser so uploads stay small (≈200–600 KB). */
export async function imageToDataUrl(file: Blob, maxDim = 1800): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("This image format can't be opened here. Try a JPG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't prepare the image");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
