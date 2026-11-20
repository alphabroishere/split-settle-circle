import { splitEqually, toPaise } from "./calc";
import type { AppState, CategoryId, Expense, Member } from "./types";

const m = (id: string, groupId: string, name: string, upiId: string, color: number): Member => ({
  id,
  groupId,
  name,
  upiId,
  color,
});

let seq = 0;
function equal(
  groupId: string,
  description: string,
  rupees: number,
  paidBy: string,
  date: string,
  category: CategoryId,
  among: string[],
): Expense {
  const amount = toPaise(rupees);
  return {
    id: `s-exp-${++seq}`,
    groupId,
    description,
    amount,
    paidBy,
    date,
    category,
    splitType: "equal",
    shares: splitEqually(amount, among),
  };
}

function custom(
  groupId: string,
  description: string,
  paidBy: string,
  date: string,
  category: CategoryId,
  sharesRupees: Record<string, number>,
): Expense {
  const shares: Record<string, number> = {};
  for (const [k, v] of Object.entries(sharesRupees)) shares[k] = toPaise(v);
  return {
    id: `s-exp-${++seq}`,
    groupId,
    description,
    amount: Object.values(shares).reduce((a, b) => a + b, 0),
    paidBy,
    date,
    category,
    splitType: "unequal",
    shares,
  };
}

export function createSampleState(): AppState {
  seq = 0;
  const room = "g-room";
  const goa = "g-goa";
  const study = "g-study";

  const roomies = ["r-aarav", "r-ishaan", "r-kabir", "r-dev"];
  const trip = ["t-priya", "t-aarav", "t-meera", "t-rohan", "t-sneha"];
  const studiers = ["s-ananya", "s-kabir", "s-zoya"];

  const members: Member[] = [
    m("r-aarav", room, "Aarav", "aarav.sharma@okaxis", 0),
    m("r-ishaan", room, "Ishaan", "ishaan.v@ybl", 1),
    m("r-kabir", room, "Kabir", "kabir07@paytm", 2),
    m("r-dev", room, "Dev", "devpatel@oksbi", 3),

    m("t-priya", goa, "Priya", "priya.nair@okicici", 4),
    m("t-aarav", goa, "Aarav", "aarav.sharma@okaxis", 0),
    m("t-meera", goa, "Meera", "meera.k@ybl", 5),
    m("t-rohan", goa, "Rohan", "rohan.das@okhdfcbank", 1),
    m("t-sneha", goa, "Sneha", "sneha.rao@paytm", 2),

    m("s-ananya", study, "Ananya", "ananya.iyer@okaxis", 3),
    m("s-kabir", study, "Kabir", "kabir07@paytm", 2),
    m("s-zoya", study, "Zoya", "zoya.m@ybl", 5),
  ];

  const expenses: Expense[] = [
    // Room 304
    equal(room, "Monthly Wi‑Fi (ACT 150 Mbps)", 999, "r-aarav", "2026-11-02", "utilities", roomies),
    equal(room, "DMart grocery run", 1840, "r-ishaan", "2026-11-04", "groceries", roomies),
    equal(room, "Midnight Maggi + chai", 320, "r-kabir", "2026-11-06", "food", ["r-aarav", "r-kabir", "r-dev"]),
    equal(room, "Electricity bill – October", 2150, "r-dev", "2026-11-08", "utilities", roomies),
    custom(room, "Domino's pizza night", "r-aarav", "2026-11-11", "food", {
      "r-aarav": 380,
      "r-ishaan": 260,
      "r-kabir": 420,
      "r-dev": 200,
    }),
    equal(room, "Bisleri water cans ×6", 240, "r-ishaan", "2026-11-13", "groceries", roomies),
    equal(room, "Gas cylinder refill", 1100, "r-kabir", "2026-11-15", "utilities", roomies),
    equal(room, "FIFA tournament snacks", 560, "r-dev", "2026-11-18", "fun", roomies),

    // Goa trip
    equal(goa, "Train tickets – Konkan Kanya (3AC)", 7450, "t-priya", "2026-10-22", "travel", trip),
    equal(goa, "Zostel Anjuna – 3 nights", 9600, "t-meera", "2026-10-23", "rent", trip),
    equal(goa, "Scooter rentals ×3", 2700, "t-rohan", "2026-10-24", "travel", trip),
    custom(goa, "Beach shack dinner at Curlies", "t-aarav", "2026-10-24", "food", {
      "t-priya": 650,
      "t-aarav": 820,
      "t-meera": 540,
      "t-rohan": 910,
      "t-sneha": 480,
    }),
    equal(goa, "Parasailing at Calangute", 3600, "t-sneha", "2026-10-25", "fun", ["t-priya", "t-meera", "t-sneha"]),
    equal(goa, "Petrol + parking", 860, "t-rohan", "2026-10-25", "travel", trip),
    equal(goa, "Breakfast at Artjuna", 1450, "t-priya", "2026-10-26", "food", trip),

    // Study group
    equal(study, "DSA notes printouts", 180, "s-ananya", "2026-11-09", "other", studiers),
    equal(study, "Cold coffee at CCD", 597, "s-zoya", "2026-11-12", "food", studiers),
    equal(study, "LeetCode Premium (shared, 1 mo)", 1299, "s-kabir", "2026-11-14", "other", studiers),
  ];

  return {
    groups: [
      {
        id: room,
        name: "Room 304 · Hostel B",
        emoji: "🛏️",
        description: "Shared bills, groceries and late-night food for our room.",
        createdAt: "2026-08-01",
      },
      {
        id: goa,
        name: "Goa Trip '26",
        emoji: "🏖️",
        description: "Post mid-sem escape. 4 days, 5 people, zero regrets.",
        createdAt: "2026-10-15",
      },
      {
        id: study,
        name: "DSA Study Circle",
        emoji: "📚",
        description: "Placement prep squad — printouts, coffee and subscriptions.",
        createdAt: "2026-11-01",
      },
    ],
    members,
    expenses,
    payments: [
      { id: "s-pay-1", groupId: goa, from: "t-sneha", to: "t-priya", amount: toPaise(1000), date: "2026-10-28" },
    ],
    activeGroupId: room,
  };
}
