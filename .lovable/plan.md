

## Plan: Editable Expense Forecast + Single Y-Axis Inventory Chart

### Two changes

**1. Make all expense forecast rows editable (not just manual ones)**

Currently only rows with `manual-` prefix IDs show inline edit fields. Auto-generated expenses (from production orders, Wayflyer, OpEx, etc.) display read-only text. The fix:
- Make all rows editable inline — date, description, category, and amount fields render as inputs for every row
- When an auto-generated expense is edited, save the override to a `savedExpenseOverrides` map in localStorage keyed by expense ID
- On render, merge overrides back onto the generated data so edits persist across refreshes
- Add a small "reset" icon per row to revert an overridden auto-generated expense back to its computed value

**2. Single Y-axis on Inventory chart capped at 50k**

Currently the chart has dual Y-axes: `yAxisId="left"` for Finished Units and `yAxisId="right"` for Tubes. This is confusing because the two scales diverge.

Fix:
- Remove the right Y-axis entirely
- Put both `inventory` (Finished Product) and `tubes` (Tubes at AES) lines on a single Y-axis with `domain={[0, 50000]}`
- Both lines share the same scale so their heights are directly comparable
- Update reference lines to use the single axis
- Update tick formatter to show `0`, `10k`, `20k`, `30k`, `40k`, `50k`

### Files to edit

**`src/components/tabs/CashPlannerTab.tsx`**:
1. Add `expenseOverrides` state (localStorage-persisted `Record<string, Partial<ScheduledExpense>>`)
2. In expense forecast table: render all rows with inline inputs (date, description, category dropdown, amount), not just manual ones
3. On change for auto-generated rows, save delta to `expenseOverrides`; merge overrides in `useMemo` that produces final expense list
4. Add per-row reset button for overridden auto-generated expenses
5. In Inventory chart (lines ~1644-1664): remove `yAxisId="right"`, set single `<YAxis domain={[0, 50000]}` with label "Units", assign both Line components to the single axis, remove the right-side YAxis, update both ReferenceLine components to use the single axis

