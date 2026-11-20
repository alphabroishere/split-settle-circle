import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** What the bill reader returns, in rupees (the UI converts to paise). */
export interface ScannedBill {
  isReceipt: boolean;
  merchant: string | null;
  date: string | null;
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number }[];
  charges: { label: string; type: "tax" | "service" | "delivery" | "packaging" | "tip" | "discount" | "other"; amount: number }[];
  subtotal: number | null;
  grandTotal: number | null;
}

export type ScanResult = { ok: true; bill: ScannedBill } | { ok: false; error: string };

const MAX_DATA_URL = 7_000_000; // ~5 MB image

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["isReceipt", "merchant", "date", "items", "charges", "subtotal", "grandTotal"],
  properties: {
    isReceipt: { type: "boolean", description: "false if the image is not a bill/receipt or is unreadable" },
    merchant: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "Bill date as YYYY-MM-DD, or null" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unitPrice", "totalPrice"],
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number", description: "Price of one unit in rupees" },
          totalPrice: { type: "number", description: "Line total in rupees as printed" },
        },
      },
    },
    charges: {
      type: "array",
      description: "Everything that is not a purchased item: each tax line, service charge, delivery, packaging, tip, discount, round-off",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "type", "amount"],
        properties: {
          label: { type: "string" },
          type: { type: "string", enum: ["tax", "service", "delivery", "packaging", "tip", "discount", "other"] },
          amount: { type: "number", description: "Rupees. Positive for discounts too; use a negative number only for a negative round-off" },
        },
      },
    },
    subtotal: { type: ["number", "null"] },
    grandTotal: { type: ["number", "null"], description: "Final amount payable, in rupees" },
  },
} as const;

const PROMPT = `You read photos of Indian restaurant, canteen, grocery and delivery bills.
Extract exactly what is printed. Do not guess or invent items. If a value is unreadable, make your best reading of the printed digits; if the image is not a bill, set isReceipt to false and return empty arrays.
- items: purchased line items only, with quantity (default 1), unit price and line total.
- charges: each tax line (CGST, SGST, VAT, GST) separately, service charge, delivery fee, packaging, tip, discounts/coupons, round-off.
- grandTotal: the final payable amount.
All money values are plain numbers in rupees (e.g. 24.5). Return JSON matching the schema.`;

export const scanBill = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        image: z
          .string()
          .max(MAX_DATA_URL, "Image is too large")
          .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/, "Upload a JPG, PNG or WebP image"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ScanResult> => {
    const { generateResponse, GatewayError, PaymentRequiredError, RateLimitError } = await import("@lovable.dev/ai-gateway");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_image", image_url: data.image, detail: "high" },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "bill", strict: true, schema } },
      });
      let text = "";
      for (const out of res.output ?? []) {
        if (out.type !== "message") continue;
        for (const c of out.content ?? []) if (c.type === "output_text") text += c.text;
      }
      if (!text) return { ok: false, error: "The bill reader returned nothing. Try a clearer photo or enter items manually." };
      const bill = JSON.parse(text) as ScannedBill;
      if (!bill.isReceipt) return { ok: false, error: "That doesn't look like a bill. Try another photo or enter items manually." };
      return { ok: true, bill };
    } catch (err) {
      console.error("scanBill failed", err);
      if (err instanceof GatewayError) {
        if (err instanceof PaymentRequiredError) return { ok: false, error: "Bill scanning is out of AI credits. Add credits in Lovable, or enter items manually." };
        if (err instanceof RateLimitError) return { ok: false, error: "Too many scans right now. Wait a minute, or enter items manually." };
      }
      return { ok: false, error: "Couldn't read this bill. Try again, or enter items manually." };
    }
  });
