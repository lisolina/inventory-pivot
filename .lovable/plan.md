

## Plan: Consolidate All Inputs into Sidebar with Production Detail

### What's changing

The current Cash Planner has inputs split between the sidebar (scalar values) and a separate "Schedule" sub-tab (supply chain events table). The user wants **everything that drives the simulation in one place — the sidebar** — with the schedule becoming a collapsible section inside it, and production inputs getting richer detail.

### New sidebar structure

1. **Starting Position** — Cash on Hand, Finished Units at Sabah, Tubes at AES (unchanged)
2. **Velocity & Channel Mix** — Weekly velocity, channel percentages (unchanged)
3. **Unit Economics** — Rev/unit per channel, COGS, DTC fulfillment (unchanged)
4. **Fixed Costs** — OpEx, Salary, Wayflyer (unchanged)
5. **Production & Packaging Orders** (collapsible, expanded) — replaces the old "Lead Times", "Payment Terms", "Production (Auto-trigger fallback)" sections and the Schedule tab:
   - Each order is a card with: tubes ordered qty, tube cost, funding tranches (add/remove rows for deposit %, date), ship date, shipping method (air freight / ocean), landed date at AES, production run date, run size, freight to Sabah, inventory arrival date at Sabah
   - "Add Order" button to create multiple staggered orders
   - This replaces the flat SC events table with a structured per-order form
6. **Production History** (collapsible) — a simple repeatable row: production run date + quantity produced, with add/remove. Used for cooldown calculations and historical reference.

### How it drives the simulation

Each production order in section 5 generates the same events the SC schedule currently does (tube payments at tranche dates, tube arrivals, production starts consuming tubes, freight arrivals adding finished product). The `useModel` hook converts these structured orders into the same internal event format. The "Schedule" sub-tab is removed from the main content area since it's now in the sidebar.

### Data model

```typescript
interface FundingTranche {
  id: string;
  pct: number;
  date: string; // YYYY-MM-DD
}

interface ProductionOrder {
  id: string;
  tubesQty: number;
  tubeCostTotal: number;
  fundingTranches: FundingTranche[];
  shipDate: string;
  shippingMethod: "air" | "ocean";
  landedDateAES: string; // tubes arrive at AES
  productionRunDate: string;
  runSize: number;
  freightToSabahDate: string; // ships from AES
  arrivalDateSabah: string; // finished product at warehouse
}

interface ProductionHistoryEntry {
  id: string;
  date: string;
  qty: number;
}
```

### Changes

**Edit `src/components/tabs/CashPlannerTab.tsx`**:
1. Add `ProductionOrder`, `FundingTranche`, `ProductionHistoryEntry` types
2. Replace the flat SC events state with `productionOrders` state array (persisted to localStorage), pre-populated with the current 30k tube / 2-tranche scenario
3. Add `productionHistory` state array
4. In the sidebar: replace "Lead Times", "Payment Terms", "Production (Auto-trigger fallback)" sections with a collapsible "Production & Packaging Orders" section containing per-order cards with all fields listed above, plus an "Add Order" button
5. Add collapsible "Production History" section with date + qty rows
6. Update `useModel`: convert `productionOrders` into the same `SupplyChainEvent[]` array format internally (tube_order payments from tranches, tube_arrival from landedDateAES, production_start from productionRunDate consuming tubes, freight_arrival from arrivalDateSabah adding finished product)
7. Remove the "Schedule" sub-tab from the main content tabs since it's now in the sidebar
8. Keep auto-trigger fallback logic and lead time defaults for future cycles beyond manually scheduled orders

### Migration

Existing `defaultScheduledEvents` data maps to one `ProductionOrder`:
- tubesQty: 30000, tubeCostTotal: 9300
- fundingTranches: [{25%, Mar 2}, {25%, Mar 16}, {50%, Apr 5}]
- shippingMethod: split into two orders — one air (15k, Apr 12) and one ocean (15k, May 3)
- Two production runs: Run 1 (May 10, 15k), Run 2 (May 17, 15k)

This becomes 2 `ProductionOrder` entries pre-populated.

