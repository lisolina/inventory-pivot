

## Plan: Dual Buffer Lines with PO Recommendation Flags

### What changes

**1. Tube buffer line on inventory chart**
Add a second `ReferenceLine` on the right Y-axis for tubes, calculated as `weeklyVelocity * (tubeLeadWeeks + productionLeadWeeks)` — i.e., enough tubes to cover one production cycle's worth of lead time. When tubes drop below this buffer, a tube order PO is flagged.

**2. Add a `tubeBufferWeeks` sidebar input** (default: 9, i.e. tube lead + production lead) so the user can tune when tube reorder triggers.

**3. Refactor production trigger logic**
- Currently production triggers when inventory hits 8wk buffer, but the run starts immediately at the trigger week
- Change: trigger week = "PO recommended" date. Actual production start = trigger week + 4 (the PO submission to production start gap)
- Add a `poToProductionWeeks` input (default: 4) — the delay between PO submission and production start

**4. PO recommendation annotations on chart**
- Extend `ProductionRunArrows` to show two types of markers:
  - Purple 🏭 arrows for production PO recommendations (when finished product hits buffer)
  - Gold 📦 arrows for tube PO recommendations (when tubes hit tube buffer)
- Each annotation hover shows "Recommended PO submission — [type]" with the date

**5. Simulation changes**
- First pass: track when `simInventory <= finishedBufferThreshold` → flag production PO at that week, actual production starts at `week + poToProductionWeeks`
- Track when `simTubes <= tubeBufferThreshold` → flag tube order PO at that week
- Return both sets of annotations plus `tubeBufferHitWeek` for metric cards

**6. New metric card**: "Tube Buffer Hit" showing when tubes drop below buffer level

### Files
- **Edit**: `src/components/tabs/CashPlannerTab.tsx`
  - Add `tubeBufferWeeks` (default 9) and `poToProductionWeeks` (default 4) to `defaultInputs`
  - Add tube buffer `ReferenceLine` on right Y-axis in inventory chart
  - Refactor first-pass trigger logic: production PO flagged at buffer hit, actual production starts `poToProductionWeeks` later
  - Add tube buffer trigger: tube PO flagged when tubes hit tube buffer threshold
  - Extend `ProductionRunArrows` to render both production and tube PO markers with distinct colors
  - Add "Tube Buffer Hit" metric card
  - Add new sidebar inputs under Lead Times section

