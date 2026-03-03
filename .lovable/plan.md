

## Plan: Consolidate All Inputs into Sidebar with Production Detail

**Status: IMPLEMENTED**

### What changed

All simulation inputs are now consolidated in the sidebar. The flat "Schedule" sub-tab has been replaced by structured **Production & Packaging Orders** (collapsible cards) and **Production History** (collapsible date+qty rows) in the sidebar.

### Data model

```typescript
interface FundingTranche { id: string; pct: number; date: string; }
interface ProductionOrder {
  id: string; tubesQty: number; tubeCostTotal: number;
  fundingTranches: FundingTranche[];
  shipDate: string; shippingMethod: "air" | "ocean";
  landedDateAES: string; productionRunDate: string; runSize: number;
  freightToSabahDate: string; arrivalDateSabah: string;
}
interface ProductionHistoryEntry { id: string; date: string; qty: number; }
```

### How it works

`productionOrdersToSCEvents()` converts structured orders into the same `SupplyChainEvent[]` format that `useModel` already consumes. The Schedule tab was removed. Auto-trigger fallback logic is preserved for cycles beyond manually scheduled orders.

### Default orders (pre-populated)

- **Order 1 (Air)**: 15k tubes, $9,300 cost, 3 tranches (25%/25%/50%), air freight Apr 12, production May 10, arrives Sabah May 24
- **Order 2 (Ocean)**: 15k tubes, no additional cost, ocean freight May 3, production May 17, arrives Sabah May 31
