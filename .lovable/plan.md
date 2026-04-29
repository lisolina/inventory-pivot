## Goal

Two upgrades to the Command Center:

1. **AI chat can write** to the database (not just read) — so you can say things like "mark Run #2 as packed", "add a $450 expense for Wayflyer", "create a task to follow up with Misfits", etc., and the AI updates the right table.
2. **Every data tile/table shows a "source" link** — a small icon you can click to jump straight to the underlying Google Sheet, Shopify admin, QuickBooks, or the Supabase table the data came from.

---

## Part 1 — AI chat write access

### How it works (technical)

Today, the `chat` edge function only takes messages and returns text. We'll upgrade it to **Anthropic tool use** so Claude can call structured "actions" we define.

New tools Claude will have access to:

| Tool | What it does | Table |
|---|---|---|
| `update_cash_balance` | Set today's cash on hand | `cash_balance` |
| `add_expense` | One-time or recurring expense | `expenses` / `recurring_expenses` |
| `add_cash_flow_entry` | Forecasted inflow/outflow on a week | `cash_flows` |
| `create_task` | Add a manual task | `tasks` |
| `create_world_task` | Substack/website/merch task | `world_tasks` |
| `update_production_run` | Move a run's stage / dates | `production_runs` |
| `add_production_cost` | Tube/ingredient/AES invoice | `production_run_costs` |
| `update_inventory_item` | Adjust on-hand or reorder level | `inventory_items` |
| `add_order` | Log a wholesale/D2C order | `orders` (+ `order_items`) |
| `update_order_status` | Mark fulfilled/invoiced/paid | `orders` |
| `add_crm_account` / `log_crm_activity` | Sales CRM updates | `crm_accounts`, `crm_activities` |
| `add_launch_milestone` | Dust launch milestone | `launch_milestones` |

Each tool has a strict JSON schema so Claude can only pass valid fields. The edge function executes the change with the service-role key, then sends the result back to Claude so it can confirm in chat ("Done — cash balance set to $23,960.25 as of Apr 29").

### Safety

- Confirmation pattern: for destructive actions (delete, large $ changes), Claude asks "Confirm?" before calling the tool.
- All writes go through validated handlers — no raw SQL from the model.
- Every AI write is logged with `source: 'ai_chat'` where the table supports it, so you can audit.

### Chat UX additions

- When Claude calls a tool, show a small inline chip in the chat: `↻ updated cash_balance` so you see what it touched.
- After a write, the relevant tab auto-refreshes (broadcast via a `window` event the tabs already listen to, or a simple page-level refetch).

---

## Part 2 — Source links on data

### Pattern

A small `↗` icon (or "source" pill) next to each tile/table header. Clicking opens the underlying source in a new tab.

### Mapping (what links to what)

| Data | Source link |
|---|---|
| Inventory tables | Master Google Sheet (already linked on Inventory tab — extend pattern) |
| Cash balance / cash flows / expenses | Master Google Sheet "Cash" tab + Supabase table view |
| Pending orders (Faire / DTC) | Shopify Admin → Orders (filtered) |
| Sales velocity | Shopify Admin → Analytics |
| Production runs | Master Google Sheet "Production" tab |
| Margins | Master Google Sheet "Margins" tab |
| QuickBooks-sourced numbers | QuickBooks Online dashboard |
| Tasks / World tasks / CRM | Supabase table editor (internal-only) |
| Dust Launch milestones | Master Google Sheet "Dust" tab |

### Implementation

- New tiny component `<SourceLink href="..." label="Google Sheet" />` — renders a muted `↗` icon with tooltip showing the source name.
- Drop it into each tab's section headers and table headers.
- For sheet links, deep-link to the specific tab using `#gid=` where known. For tabs whose `gid` we don't know yet, link to the sheet root and I'll note the ones to refine later.
- Shopify links use the existing store URL pattern already in `src/components/PendingOrders.tsx`.

### What's NOT possible (caveats)

- We can deep-link to a Google Sheet **tab** but not to a specific row — Sheets doesn't support row anchors reliably.
- QuickBooks deep-links to reports work but require you to be logged into QBO.
- For data that's purely computed (e.g. "weeks of cover"), the link goes to the *underlying* source (inventory sheet), not the computation.

---

## Files that will change

**New**
- `src/components/SourceLink.tsx` — reusable source-link icon
- `src/lib/sources.ts` — central map of source URLs (sheet IDs, Shopify URLs, QBO URLs)

**Edited**
- `supabase/functions/chat/index.ts` — add Anthropic tool-use loop with all write handlers
- `src/components/AIChatWidget.tsx` — render tool-use chips inline; trigger refresh after writes
- `src/components/tabs/*.tsx` — add `<SourceLink>` to each major section/table header (Dashboard, Inventory, Orders, Money, BankWeekly, CashPlanner, Production, Margins, SalesCRM, DustLaunch, WorldBuilding)
- `src/components/PendingOrders.tsx`, `InventoryTable.tsx`, `CashFlowChart.tsx`, etc. — add source links on individual tile headers

---

## Open question

For QuickBooks links — do you want them to point to:
- (a) the QBO **dashboard** (generic), or
- (b) specific QBO **reports** (P&L, Cash Flow Statement) deep-linked?

I'll default to (b) — specific reports — unless you say otherwise after approval.
