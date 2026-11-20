import {
  Bus,
  Gamepad2,
  Home,
  Lightbulb,
  Package,
  ShoppingBasket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { CategoryId } from "./types";

export const CATEGORIES: { id: CategoryId; label: string; icon: LucideIcon; chart: string }[] = [
  { id: "food", label: "Food & Drinks", icon: UtensilsCrossed, chart: "var(--chart-1)" },
  { id: "groceries", label: "Groceries", icon: ShoppingBasket, chart: "var(--chart-2)" },
  { id: "rent", label: "Rent & Stay", icon: Home, chart: "var(--chart-4)" },
  { id: "utilities", label: "Bills & Wi‑Fi", icon: Lightbulb, chart: "var(--chart-3)" },
  { id: "travel", label: "Travel", icon: Bus, chart: "var(--chart-5)" },
  { id: "fun", label: "Fun", icon: Gamepad2, chart: "var(--chart-6)" },
  { id: "other", label: "Other", icon: Package, chart: "var(--muted-foreground)" },
];

export const getCategory = (id: CategoryId) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!;
