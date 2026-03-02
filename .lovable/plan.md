

## Plan: Inventory Chart Annotations, OpEx Breakdown, Production Funding Dates

### 1. Inventory chart — production run arrows

Add `ReferenceLine` or custom dot markers on the inventory chart at weeks where production runs are triggered. Each marker gets a hover tooltip: "Production run forecast — [run size] units".

Use Recharts `customized` layer or `ReferenceLine` with a label for each trigger week of type `"production"` from the triggers array. Return the trigger weeks from `useModel` so the chart can render them.

### 2. Fix OpEx modeling — separate salary from operating expenses

**Current bug**: `monthlyOpex / 4.33` treats the full $10k as a weekly spread. User wants:
- **Salary**: $2,500/mo, hits on the 1st of each month (not spread weekly)
- **Remaining OpEx**: ($monthlyOpex - salary) spread across weeks in that month

**New sidebar inputs**:
- `monthlySalary` (default 2500) — separate from monthlyOpex
- Reduce `monthlyOpex` default to 7500 (the non-salary portion)

**Simulation change**: In the weekly loop, check if the week contains the 1st of a month. If so, add the salary as a lump-sum outflow that week. Spread remaining OpEx as `(monthlyOpex - 0) / weeksInMonth` for that month's weeks. This replaces the flat `monthlyOpex / 4.33`.

### 3. Production inputs — funding date fields

Add explicit date inputs alongside each production cost field in the sidebar:
- `ingredientFundingDate` (default "2026-04-15") — the exact date the ingredient cost hits cash
- `productionFundingDate` (default "2026-05-31") — the exact date AES invoice is due (net 30 from production date 5/1)
- `freightFundingDate` (optional, or keep derived from lead times)

When these dates are set, they **override** the model's calculated payment weeks. The simulation converts each funding date to its corresponding week index and places the cash outflow there instead of using the formula-derived week.

**Sidebar UI**: Use a text date input (or simple `YYYY-MM-DD` input) next to each cost/unit field, displayed as a pair.

### Files
- **Edit**: `src/components/tabs/CashPlannerTab.tsx`

