

## Plan: Fix Inventory Chart Data, Add Tube Order Date, Show Current Date on Today Button

### Issues to Fix

1. **Tubes at AES shows -10000**: The simulation starts `tubes = tubesOnHand` (25000 from defaults) but the user says tubes at AES are currently **0**. The default `tubesOnHand` is 25000 — user needs to set it to 0. But also the simulation subtracts `productionRunSize` from tubes when a production trigger fires (line 393/640), which can push tubes negative. Need to clamp tubes to never go below 0 on the chart.

2. **Inventory shows 2500 instead of 3400**: The default `inventoryOnHand` is 8000. User needs to update to 3400. This is a sidebar input issue — the user's saved values may differ. We should update defaults to match reality and ensure the chart reads from the input field correctly.

3. **Production run on Mar 1 is wrong**: The simulation triggers a production run at week 0 because inventory (3400) is already below the buffer threshold (1000 * 8 = 8000). Need to add a `lastProductionRunDate` input so the user can specify when the last run was (2/16), and the cooldown prevents a false trigger. Also add a `nextProductionRunDate` input for manually scheduling the next run.

4. **Tube order date field missing**: Add a `tubeOrderDate` input in sidebar. When set, the tube order is placed on that specific date (converted to week index) rather than auto-triggered.

5. **Today button should show current date**: Display the actual date (e.g., "Mar 2, 2026") below or next to the Today button.

### Changes — `src/components/tabs/CashPlannerTab.tsx`

**a) New default inputs:**
- `tubesOnHand`: 0 (not 25000)
- `inventoryOnHand`: 3400 (not 8000)
- `tubeOrderDate`: "2026-03-02" (date the 30k tube order was placed)
- `lastProductionRunDate`: "2026-02-16"

**b) Simulation logic updates:**
- Clamp `tubes` to `Math.max(0, tubes)` after any subtraction
- When `tubeOrderDate` is set, place the tube order on that specific week instead of auto-triggering based on tube buffer. The tube tranches then cascade from that date.
- Use `lastProductionRunDate` to set initial `simNextProd` cooldown so no false production trigger fires at week 0
- Production triggers should respect cooldown from last known run

**c) Today button UI:**
- Show current date text below the Today button: `format(new Date(), "MMM d, yyyy")`

**d) Sidebar additions:**
- Add `tubeOrderDate` date input next to "Tube Order Size"
- Add `lastProductionRunDate` date input in a new "Production History" section or near production inputs

### Files
- **Edit**: `src/components/tabs/CashPlannerTab.tsx`

