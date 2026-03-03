

## Plan: Supply Chain Event Scheduler

### Problem
The current model assumes uniform tube orders and production runs — one size, one lead time, one arrival. Your real scenario has staggered tranches (air freight Apr 12, ocean freight ~May 3), split production runs (15k each), and cascading timelines. Adding more individual input fields won't scale — you need a **scheduled events table**.

### Solution: Replace auto-trigger logic with a manually editable event schedule

Add a **Supply Chain Schedule** — a table of discrete planned events the user defines, each with a date, type, quantity, and cost. The simulation processes these events in date order instead of (or alongside) the auto-trigger system.

### Event types

| Type | Fields | Effect on simulation |
|------|--------|---------------------|
| `tube_order` | date, qty, cost, payment split | Schedules tube payment tranches |
| `tube_arrival` | date, qty, source label | Adds tubes to AES inventory |
| `production_start` | date, qty (tubes consumed) | Consumes tubes, starts production timer |
| `production_complete` | date, qty | Triggers AES invoice + freight |
| `freight_arrival` | date, qty | Adds finished goods to Sabah inventory |

### UI approach

**New "Schedule" sub-tab** inside Cash Planner (alongside Cash Forecast, Inventory & Timing, Pipeline):
- Table with columns: Date, Type (dropdown), Description, Qty, Cost
- Pre-populated with the user's current real scenario (air freight Apr 12, ocean May 3, etc.)
- Add/remove rows
- Events saved to localStorage alongside other inputs

### Example: User's current scenario as events

```text
Mar 2   tube_order        30k tubes ordered, deposit 25%        $2,325
Mar 16  tube_payment      Printing complete, 25%                $2,325
Apr 5   tube_payment      Balance before ship, 50%              $4,650
Apr 12  tube_arrival      Air freight tranche — 15k tubes        15,000
May 3   tube_arrival      Ocean freight tranche — 15k tubes      15,000
May 10  production_start  Run 1 — 15k tubes consumed             15,000
May 17  production_complete  Run 1 done → freight ships           15,000
May 24  freight_arrival   Run 1 — 15k units arrive at Sabah      15,000
May 17  production_start  Run 2 — 15k tubes consumed             15,000
May 24  production_complete  Run 2 done                           15,000
May 31  freight_arrival   Run 2 — 15k units arrive at Sabah      15,000
```

### Simulation changes

- The `useModel` first-pass trigger logic gains a new path: if `scheduledEvents` exist, process them by date instead of auto-triggering
- Auto-trigger still works as a fallback for future cycles beyond the manually scheduled ones
- Each event type maps to specific simulation effects (add/subtract inventory, schedule payments, etc.)

### Changes — `src/components/tabs/CashPlannerTab.tsx`

1. **New type** `ScheduledEvent` with fields: `id, date, type, description, qty, cost, paymentPct`
2. **New state** `scheduledEvents` array, saved/loaded from localStorage
3. **New Schedule sub-tab** with editable table + add/remove controls
4. **Simulation update**: process scheduled events by converting dates to week indices and applying effects in the main simulation loop
5. **Keep auto-trigger as fallback** for periods beyond the last scheduled event
6. **Pre-populate defaults** matching the user's current real scenario

### Files
- **Edit**: `src/components/tabs/CashPlannerTab.tsx`

