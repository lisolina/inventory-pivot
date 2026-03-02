

## Plan: Fix Reset Button + Add Cash Flow Breakdown Notes

### 1. Fix Reset/Refresh button behavior

**Problem**: The reset button (`RotateCcw`) currently restores hardcoded defaults and clears localStorage. User wants it to reload the last **saved** inputs instead — essentially "undo unsaved changes."

**Fix in `CashPlannerTab.tsx`**:
- Change `handleReset` to reload from `localStorage` (the last saved state) instead of `defaultInputs`
- If nothing is saved yet, fall back to defaults
- Update the toast message to "Inputs refreshed from last save"

### 2. Add breakdown notes to cash inflows and outflows

**In the `useModel` simulation loop**, track per-week breakdown arrays showing what each outflow/inflow is for:

Each week's data will include:
- `cashInBreakdown`: e.g. `[{label: "Faire Revenue", amount: 3645}, {label: "DTC Revenue", amount: 325}]`
- `cashOutBreakdown`: e.g. `[{label: "OpEx", amount: 2309}, {label: "Wayflyer", amount: 416}, {label: "DTC Fulfillment", amount: 24}, {label: "Tube Order (30k)", amount: 9300}]`

**Display**: Add a custom Recharts tooltip on the Cash Forecast chart that shows the itemized breakdown instead of just totals. Also add a small weekly breakdown table below the Net Cash Flow chart showing inflow/outflow line items for the selected or hovered week.

### 3. Tube order size sanity check note

Add a note in the Action Plan tab when a tube order is triggered, showing the math: "30,000 tubes at current velocity (1,000/wk) = 30 weeks of tube supply. At $0.31/tube = $9,300 cash outlay." This helps the user evaluate if the order size makes sense.

### Files
- **Edit**: `src/components/tabs/CashPlannerTab.tsx` — all changes in this single file

