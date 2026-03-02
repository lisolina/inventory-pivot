

## Plan: Shopify Orders Integration, Cash Flow Projections, and Dust Launch HQ

### Part 1: Fix Shopify/Faire Orders

The `fetch-pending-orders` edge function already has Shopify API logic and secrets are configured (`SHOPIFY_ADMIN_API_KEY`, `SHOPIFY_STORE_URL`). However, the `ChannelTiles` component only reads from the local `orders` table — it never calls `fetch-pending-orders`. The fix:

- **Update `OrdersTab`** to call `fetch-pending-orders` on mount, which fetches live Shopify orders (Faire + DTC) and merges them with local DB orders for display in Channel Tiles
- **Also fetch fulfilled/historical orders** from Shopify by adding a `status=any&fulfillment_status=fulfilled` query to the edge function (new `includeHistorical` flag)
- **Sync Shopify orders into the `orders` table** so they appear in the main order table with proper source tagging (`faire` vs `shopify`)
- Update the Shopify API version from `2024-01` to `2025-07`

### Part 2: Cash Flow Projections

New component `CashFlowProjection` on the Money tab with:

**a) Projection chart** — a forward-looking line chart showing projected balance over the next 30/60/90 days, built from:
- Current cash balance as starting point
- Expected **inflows**: pending invoices (receivables) by due date
- Expected **outflows**: vendor invoices, manually added expenses, and detected recurring expenses

**b) NL expense input** — a text input on the Money tab (similar to NL order input) where you type "We have a $2,000 payment for tubes packaging to Jemstone upcoming on March 15" → AI parses and inserts into `expenses` table with date, amount, description, category

**c) Recurring expense detection** — scan `cash_entries` for patterns (same description + similar amount appearing monthly, e.g., "LOVABLE", "QUICKBOOKS", "SHOPIFY"). Store detected subscriptions in a new `recurring_expenses` table with `name`, `amount`, `frequency`, `next_due_date`. Display these as a list the user can confirm/edit.

**d) Inflow/outflow calendar** — a mini calendar view showing dates with expected money in (green dots from receivable invoices) and money out (red dots from vendor invoices + expenses). Click a date to see details.

### Part 3: Dust Launch HQ Tab

New tab next to Sales CRM. New database table `launch_milestones`:
- `id`, `launch_id`, `title`, `category` (ordering, production, packaging, go-to-market), `deadline`, `status` (pending/done), `cash_impact`, `notes`, `created_at`

New database table `launch_products`:
- `id`, `name` (Porcini, Assassina, Cacio e Pepe), `unit_price`, `tube_cost`, `ingredient_cost`, `production_cost`, `target_launch_date`, `notes`

The tab will have:
- **Product cards** for each new SKU with cost breakdown and target dates
- **Milestone timeline** — a checklist/Gantt-style view showing drop-dead dates for ordering tubes, ingredients, production with AES, etc.
- **Cash impact view** — ties into the cash flow projection to show "on X date you need $Y for tubes, your projected balance is $Z" with green/red indicators
- **Payment terms + lead times** — fields per milestone to account for net-30/60 terms and supplier lead times, auto-calculating when orders must be placed

### Database Changes
- New table: `recurring_expenses` (id, name, amount, frequency, next_due_date, category, active, created_at)
- New table: `launch_milestones` (id, product_id, title, category, deadline, status, cash_impact, lead_time_days, payment_terms, notes, created_at)
- New table: `launch_products` (id, name, unit_price, tube_cost, ingredient_cost, production_cost, target_launch_date, notes, created_at)
- RLS: authenticated users full CRUD on all three

### Files to Create/Edit
- **Create**: `src/components/CashFlowProjection.tsx` — projection chart + calendar
- **Create**: `src/components/NLExpenseInput.tsx` — natural language expense entry
- **Create**: `src/components/RecurringExpenses.tsx` — detected subscriptions list
- **Create**: `src/components/tabs/DustLaunchTab.tsx` — launch HQ tab
- **Edit**: `supabase/functions/fetch-pending-orders/index.ts` — add historical orders flag, update API version
- **Edit**: `src/components/tabs/OrdersTab.tsx` — call fetch-pending-orders, merge Shopify orders into channel tiles
- **Edit**: `src/components/tabs/MoneyTab.tsx` — add projection chart, NL expense input, recurring expenses, calendar
- **Edit**: `src/pages/Index.tsx` — add Dust Launch HQ tab
- **Migration**: create `recurring_expenses`, `launch_milestones`, `launch_products` tables

### Implementation Order
1. Shopify orders integration (edge function + OrdersTab)
2. NL expense input + recurring expense detection
3. Cash flow projection chart + calendar
4. Dust Launch HQ tab + migration

