

## Plan: Full-Year Simulation with Sliding 16-Week View Window

### Problem
The `useModel` hook runs a 16-week simulation starting from `startWeekOffset`, initializing cash/inventory/tubes to the current input values at that start week. When you advance the view forward, it resets everything as if those inputs apply at the new start date — losing all the accumulated changes from prior weeks.

### Solution
Simulate from **today** (`currentWeekIndex()`) through **end of year** (~48 weeks from today), then **slice** the 16-week window for chart display based on `startWeekOffset`.

### Changes — `src/components/tabs/CashPlannerTab.tsx`

**a) `useModel` signature change:**
- Add `todayWeekOffset` parameter (always `currentWeekIndex()`) — this is the simulation start point
- `startWeekOffset` becomes the **view window** start, not the simulation start
- Compute `totalSimWeeks` = weeks from today through ~Dec 27, 2026 (end of year)

**b) Simulation runs from today through year-end:**
- The loop runs `totalSimWeeks` iterations starting from `todayWeekOffset`
- All trigger logic, cash flows, tube orders, production runs — everything accumulates from today's inputs across the full range
- `weeklyData` array holds all simulated weeks

**c) Slice for display:**
- After full simulation, slice `weeklyData` from `startWeekOffset - todayWeekOffset` for 16 weeks
- Chart renders only the sliced window
- Metric cards (OOS, buffer hits, min cash) computed from the **full** simulation
- Production annotations filtered to the visible 16-week window

**d) Navigation bounds:**
- `goBack` clamped so you can't go before today
- `goForward` clamped so last visible week doesn't exceed year-end

**e) Today button shows current date** (already partially done — ensure it works with new model)

### Files
- **Edit**: `src/components/tabs/CashPlannerTab.tsx`

