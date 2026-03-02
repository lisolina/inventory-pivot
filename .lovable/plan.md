

## Phase 1: Realistic Cash Planner — Payment Timing, Dynamic Reordering, Interactive Inventory

All changes in `src/components/tabs/CashPlannerTab.tsx`.

### 1. New Sidebar Inputs

Add these fields to the model:
- **Tube Payment Split** — `tubePaymentPct1` (default 50): % paid upfront, remainder on delivery
- **Ingredient Lead Weeks** — `ingredientLeadWeeks` (default 2): how many weeks before production starts to order ingredients
- **AES Net Terms** — `aesNetDays` (default 30): AES production invoice paid Net 30 after run completes

### 2. Timed Payment Logic in Simulation

Replace the current "all costs hit immediately" approach:

**Tubes**: Split into two cash events — `tubePaymentPct1`% on order week, remainder on delivery week (order week + `tubeLeadWeeks`).

**Ingredients**: Cash hits `ingredientLeadWeeks` before the production run starts (i.e., when tubes arrive at AES). Separate line item in breakdown.

**AES Production Cost**: Deferred to `productionCompleteWeek + 4 weeks` (Net 30). Production completes at order week + tube lead + production lead. Invoice hits 4 weeks after that.

**Freight**: Hits when goods ship (production complete week).

Each becomes a separate entry in `cashOutBreakdown` with its own date.

### 3. Dynamic Continuous Reordering

Replace the single-use `tubeOrderPlaced` / `productionPlaced` boolean flags with a **cooldown tracker**:

- Track `nextEligibleProductionWeek` (starts at 0)
- When inventory crosses the buffer threshold (`weeklyVelocity * minWeeksStock`) AND `w >= nextEligibleProductionWeek`, trigger a new production cycle
- Set `nextEligibleProductionWeek = w + totalLeadWeeks` (can't retrigger until current run lands)
- Same pattern for tube orders — check tube stock relative to upcoming production needs
- This allows multiple production runs across the 16-week window

### 4. Expense Forecast with Approval

Add a `scheduledExpenses` array to model output. Each entry:
```
{ id, weekIndex, dateLabel, description, amount, category, approved: boolean }
```

- All triggered costs (ingredients, AES invoice, tube tranches, freight) become scheduled expenses
- New UI section in the **Action Plan** tab: "Expense Forecast" table with approve/reject toggle per row
- Store approvals in component state (and localStorage via save)
- Only `approved` expenses flow into the cash simulation; unapproved show as dashed/pending in charts

### 5. Interactive Inventory Tab

- When inventory crosses the 8-week buffer, show the exact date with an annotation on the chart (e.g., "Apr 23 — hits 8wk buffer")
- Add a "Pipeline" section below the chart showing in-flight orders: tubes en route, production in progress, freight in transit — each with expected arrival date
- Show a plain-English reorder recommendation: "Initiate production by [date] to maintain stock. This requires [X] tubes, [Y] ingredients, costing [$Z] across 3 payments."

### 6. Action Plan Cascade View

Upgrade triggered actions to show the full cascade:
```
Tube Order (Week of Mar 3) → $4,650 upfront
  ↳ Tubes arrive at AES (Week of Apr 7)
  ↳ Ingredient order (Week of Mar 24) → $3,500
  ↳ Production run starts (Week of Apr 7) → AES invoice due May 5
  ↳ Freight ships (Week of Apr 21) → $350
  ↳ Inventory arrives at Sabah (Week of Apr 28) → +10,000 units
```

### Files
- **Edit**: `src/components/tabs/CashPlannerTab.tsx` — all changes in this single file

