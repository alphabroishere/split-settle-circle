import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/splitmate/calc";
import type { Member } from "@/lib/splitmate/types";
import type { ReactNode } from "react";

const AVATAR_TONES = [
  "bg-chart-1 text-highlight-foreground",
  "bg-chart-2 text-positive-foreground",
  "bg-chart-3 text-negative-foreground",
  "bg-chart-4 text-primary-foreground",
  "bg-chart-5 text-primary-foreground",
  "bg-chart-6 text-primary-foreground",
];

export function MemberAvatar({
  member,
  size = "md",
  className,
}: {
  member: Pick<Member, "name" | "color"> | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = (member?.name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ring-2 ring-card",
        AVATAR_TONES[(member?.color ?? 0) % AVATAR_TONES.length],
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-12 text-base",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Signed balance: green when you get money back, coral when you owe. */
export function BalanceAmount({ value, className, showSign = true }: { value: number; className?: string; showSign?: boolean }) {
  const tone = value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-muted-foreground";
  const sign = !showSign || value === 0 ? "" : value > 0 ? "+" : "−";
  return <span className={cn("money font-semibold", tone, className)}>{sign}{formatINR(Math.abs(value))}</span>;
}

export function BalancePill({ value }: { value: number }) {
  if (value === 0)
    return <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Settled</span>;
  return value > 0 ? (
    <span className="whitespace-nowrap rounded-full bg-positive-soft px-2.5 py-0.5 text-xs font-semibold text-positive">Gets back</span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-negative-soft px-2.5 py-0.5 text-xs font-semibold text-negative">Owes</span>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("min-w-0 rounded-2xl border bg-card p-5 shadow-card sm:p-6", className)}>{children}</section>;
}

export function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <div className="mb-3 text-4xl">{emoji}</div>
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="mt-2 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
