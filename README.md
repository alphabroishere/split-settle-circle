# SplitMate 💸

**Split expenses fairly. Settle up with fewer payments.**

SplitMate is an expense-splitting web app designed for hostel students, roommates, and friend groups. It helps groups record shared expenses, divide bills fairly—including item-wise splits—and calculate who owes whom with a settlement plan that minimizes the number of transactions.

## 🚀 Live Demo

[Open SplitMate](https://split-settle-circle.lovable.app)

## 🧩 Problem

Groups of friends and hostel roommates often share meals, groceries, travel, and other expenses. Tracking who paid, how much each person owes, and settling balances can become confusing—especially when expenses are not divided equally.

## 💡 Solution

SplitMate keeps shared expenses organized in one place. Members can record expenses, choose how they are split, view balances, and get a simplified settlement plan. Suggested payments can open a UPI app through a payment link.

## ✨ Features

- **Expense groups and members** — organize expenses for a hostel group or friends.
- **Expense tracking** — record the amount, payer, description, category, date, and participants.
- **Equal splitting** — divide an expense equally among selected members.
- **Custom / unequal splitting** — specify each member's share.
- **Bill-photo item-wise splitting** — split a bill by assigning individual items to group members.
- **Accurate rounding** — handle amounts to the paise and ensure allocations reconcile with the bill total.
- **Balance tracking** — view how much each member paid, their share, and their net balance.
- **Minimum-transactions settlement** — generate a settlement plan designed to reduce the number of payments needed to clear group balances.
- **UPI payment links** — launch a compatible UPI app from a suggested settlement.
- **Dashboard** — view group expenses and balances at a glance.
- **Responsive UI** — use the app on desktop or mobile.

## 🧮 Settlement algorithm

SplitMate calculates each member's net balance, then pairs people who are owed money with people who owe money to generate settlement suggestions. The goal is to clear balances using as few transactions as possible. The implementation is tested against a brute-force reference for small groups.

## 🛠️ Tech Stack

- React 19
- TypeScript
- TanStack Start / TanStack Router
- Vite
- Tailwind CSS
- Vitest
- Lucide icons and supporting UI libraries

## 🧪 Testing

Automated tests cover expense splitting, item-wise allocations, rounding, validation, and settlement logic. The project was reported to have **55 automated tests passing** during development.

## ▶️ Run locally

Requirements: Node.js and npm.

```bash
git clone https://github.com/alphabroishere/split-settle-circle.git
cd split-settle-circle
npm install
npm run dev
```

Other useful scripts:

```bash
npm run build
npm run test
npm run lint
```

## 🤖 Development Tools & Disclosure

SplitMate was developed with assistance from **Lovable** (AI-powered development platform). The project was tested and iteratively refined, including validation of expense splitting, settlement calculations, and UPI link behavior.

## 🔮 Future Scope

- User authentication and persistent cloud storage
- Group invitations and shared access
- Settlement history and notifications
- Improved receipt scanning and item recognition
- More payment-provider integrations

---

Built for a hackathon problem focused on expense splitting for hostel groups.
