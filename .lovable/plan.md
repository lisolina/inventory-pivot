## Plan: L'Isolina Command Center Upgrade

The 6 tables in the prompt do **not** exist yet — I'll create them. The Google Sheet is private and I can't read it from here, so table columns will follow the spec exactly. Existing tabs (DustLaunch, CashPlanner, MoneyTab, etc.) stay intact — new tabs are added alongside, and the existing CashPlanner gets a new top section instead of being replaced.

### Section 1 — Database migration (6 new tables + RLS)

Create:
- `production_runs` (run_id text PK, run_name, product_line, skus text[], target_units int, actual_units int, expected_revenue numeric, stage text default 'planning', tubes_ordered_date, tubes_landed_date, ingredients_staged_date, aes_pack_start, aes_pack_complete, shipped_date, notes, timestamps)
- `production_run_costs` (id uuid PK, run_id text FK, expense_type, vendor, amount numeric, date_incurred, date_due, date_paid, status, notes)
- `channel_margins` (id uuid PK, product_line, channel, landed_cogs, net_price_per_unit, fulfillment_fees_per_unit, cm_dollars, cm_percent, notes, last_updated)
- `cash_flows` (id uuid PK, week_starting date, description, category, inflow numeric, outflow numeric, status, notes)
- `cash_balance` (id uuid PK, date date, balance numeric, notes, created_at)
- `recipes` (id uuid PK, sku, ingredient, amount_per_unit_grams numeric, supplier, cost_per_unit numeric, notes)

All tables: RLS enabled, `authenticated` users full CRUD (matches existing pattern).

### Section 2 — Production Runs tab (new tab, keeps existing DustLaunchTab)

Add `ProductionRunsTab.tsx` and a new top-nav entry "Production":
- One card per run; horizontal stage stepper with 9 buttons (planning → tubes_ordered → tubes_in_transit → tubes_at_aes → ingredients_staged → packing → finished_goods → shipped → complete). Click to advance — writes stage + appropriate date column.
- Card body: target units, actual units, expected revenue, current stage badge (green/blue/gray).
- Cost summary table per run, reading `production_run_costs` filtered by run_id. Inline-editable rows (auto-save on blur).
- "Add new run" + "Add cost" modal forms.

### Section 3 — Margins tab (new)

Add `MarginsTab.tsx` and nav entry. Two sections: "Spaghetti Dust" and "Pasta".
- Table cols: Channel | COGS | Net Price | Fees | CM $ | CM % | Notes.
- Click-to-edit cells with auto-save on blur; CM $ and CM % auto-recompute (`net - cogs - fees`, `(net-cogs-fees)/net`).
- Row color: CM% ≥60 green / 45–59 neutral / <45 amber.
- "Update COGS" button per section: prompts a number, bulk-updates `landed_cogs` for that product_line.

### Section 4 — Cash Planner upgrade (additive, on top of existing tab)

Add a new "Bank & 8-Week" panel above the existing planner content:
- Bank balance card: latest `cash_balance` row with date; inline "$ ___ + Update" writes a new row.
- Operating floor input (localStorage, default 15000).
- 8-week table reading `cash_flows`, computing running balance week-by-week starting from latest bank balance. Per-row inline editing (description, inflow, outflow, status); auto-save on blur.
- Row color by ending balance vs floor: >floor+5k green / 0–5k amber / negative red.
- "Add cash flow entry" modal.

Existing CashPlanner simulation remains untouched below.

### Section 5 — Google Sheets sync badge

Small badge in `Index.tsx` top nav near tabs:
- Reads `localStorage.lastSheetsSync` (set whenever the existing `sync-google-sheets` flow runs — hook into existing call sites in InventoryTab / DashboardTab).
- Dot color: <24h green / 1–3d amber / >3d red.
- Click opens an info `Dialog` describing the sync.

### Section 6 — AI chat widget upgrade

Modify `AIChatWidget.tsx` to fetch on mount:
- Latest `cash_balance` row
- `cash_flows` for next 8 weeks (week_starting between today and +56d)
- `inventory_items` where parsed `units_on_hand < reorder_level`
- `production_runs` where stage NOT IN ('complete','shipped')
- Current month sum from `cash_entries`

Inject into a system message that uses the exact text from the prompt, with placeholders filled in. Send as the first message to the existing `chat` edge function with `stream: true` (current SSE path).

### Section 7 — Dashboard stale-data banners

Add a `StaleDataBanners` component to top of `DashboardTab.tsx`:
- "Cash balance not updated today" (weekdays only; check latest `cash_balance.date`). Inline `$___ [Update]` writes to `cash_balance`.
- "Inventory > 7 days old" (max `inventory_items.last_synced`).
- "Production stages not advanced this week" (max `production_runs.updated_at` < 7 days ago).

Each banner dismissible with `localStorage.dismissed_<key>_<YYYY-MM-DD>`; reappears next day.

### Section 8 — Inline edit pattern

Build small reusable `<EditableCell>` helper used across Margins / Cash Flows / Production Runs cost rows:
- Click cell → input; blur or Enter saves; Esc cancels.
- Optimistic state update; tiny "Saving…" → "Saved ✓" pill (auto-hides after 1.5s).
- Required-field validation: red border if blank on save.

### Technical details

**Files created**
- `src/components/tabs/ProductionRunsTab.tsx`
- `src/components/tabs/MarginsTab.tsx`
- `src/components/BankAndWeeklyPanel.tsx` (mounted at top of CashPlannerTab)
- `src/components/StaleDataBanners.tsx` (mounted at top of DashboardTab)
- `src/components/SheetsSyncBadge.tsx` (mounted in Index nav)
- `src/components/EditableCell.tsx`

**Files modified**
- `src/pages/Index.tsx` — add 2 new tabs + sync badge
- `src/components/tabs/CashPlannerTab.tsx` — mount BankAndWeeklyPanel at top
- `src/components/tabs/DashboardTab.tsx` — mount StaleDataBanners at top
- `src/components/AIChatWidget.tsx` — fetch context, build system prompt verbatim from prompt spec
- Existing sync entry points — write `localStorage.lastSheetsSync` on success

**Migration** — single SQL migration creating the 6 tables + RLS policies. No seed data; user fills via UI.

**No changes** to existing edge functions, DustLaunchTab, MoneyTab, OrdersTab, SalesCRMTab, WorldBuildingTab, or any working flow.

### Open items I'll assume unless you say otherwise
- Inventory "alerts" use `inventory_items.units_on_hand` parsed as int compared to `reorder_level` (the prompt says `reorder_trigger`, which doesn't exist).
- Current month "revenue" comes from `cash_entries` where `type='inflow'` for the current month (no `revenue` table exists).
- Bank/8-week panel is added on top of CashPlanner rather than replacing the existing simulation, so your saved buffers/forecasts remain.
