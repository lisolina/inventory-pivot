import { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Package, DollarSign, ShieldCheck, Save, RotateCcw, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { addWeeks, format, differenceInWeeks, startOfWeek } from "date-fns";

// ── Epoch: Week 1 starts Jan 1, 2026 ───────────────────────────────
const EPOCH = new Date(2026, 0, 1); // Jan 1 2026 (Thu)

function weekToDate(weekIndex: number): Date {
  return addWeeks(EPOCH, weekIndex);
}

function currentWeekIndex(): number {
  return differenceInWeeks(new Date(), EPOCH);
}

function weekLabel(weekIndex: number): string {
  const d = weekToDate(weekIndex);
  return format(d, "MMM d");
}

// ── Default model inputs ────────────────────────────────────────────
const defaultInputs = {
  cashOnHand: 35385,
  weeklyVelocity: 1000,
  faireShare: 90,
  wbcShare: 5,
  dtcShare: 5,
  faireRevPerUnit: 4.05,
  wbcRevPerUnit: 4.0,
  dtcRevPerUnit: 6.5,
  cogsPerUnit: 1.65,
  dtcFulfillmentPerUnit: 0.48,
  fairePayout: 0,
  wbcPaymentDays: 30,
  dtcPayout: 2,
  monthlyOpex: 10000,
  wayflierBiweekly: 833,
  inventoryOnHand: 8000,
  tubeLeadWeeks: 5,
  productionLeadWeeks: 2,
  freightToSabahWeeks: 1,
  minWeeksStock: 8,
  productionRunSize: 10000,
  tubeOrderSize: 30000,
  tubeCostPer: 0.31,
  ingredientCostPerUnit: 0.35,
  productionCostPerUnit: 0.35,
  freightPerRun: 350,
  tubesOnHand: 25000,
};

const STORAGE_KEY = "lisolina-planner-inputs";

function loadSavedInputs(): Inputs {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultInputs, ...JSON.parse(saved) };
  } catch {}
  return defaultInputs;
}

type Inputs = typeof defaultInputs;

// ── Sidebar input field ─────────────────────────────────────────────
function InputField({
  label, value, onChange, prefix, suffix, step,
}: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number;
}) {
  return (
    <div className="mb-2.5">
      <Label className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1 mt-1">
        {prefix && <span className="text-xs font-semibold text-foreground">{prefix}</span>}
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step || 1}
          className="h-8 text-xs font-mono font-semibold"
        />
        {suffix && <span className="text-[11px] text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Metric card ─────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, variant = "default", icon: Icon,
}: {
  label: string; value: string; sub?: string;
  variant?: "default" | "success" | "warning" | "danger";
  icon?: React.ElementType;
}) {
  const borderClass =
    variant === "danger" ? "border-destructive bg-destructive/5" :
    variant === "warning" ? "border-warning bg-warning/5" :
    variant === "success" ? "border-success bg-success/5" :
    "border-border";
  const valueClass =
    variant === "danger" ? "text-destructive" :
    variant === "warning" ? "text-warning" :
    variant === "success" ? "text-success" :
    "text-foreground";

  return (
    <Card className={`flex-1 min-w-[150px] ${borderClass}`}>
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
        </div>
        <div className={`text-xl font-bold font-mono ${valueClass}`}>{value}</div>
        {sub && (
          <div className={`text-[11px] mt-0.5 ${variant === "danger" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section header ──────────────────────────────────────────────────
function SectionHeader({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3 mt-6">
      <h3 className="text-sm font-bold tracking-wide text-foreground">{children}</h3>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Sidebar section label ───────────────────────────────────────────
function SidebarSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-widest text-accent uppercase border-b border-accent/30 pb-1 mb-2 mt-4 first:mt-0">
      {children}
    </div>
  );
}

// ── Core planner model (16-week simulation) ─────────────────────────
function useModel(inputs: Inputs, startWeekOffset: number) {
  return useMemo(() => {
    const weeks = 16;
    const {
      cashOnHand, weeklyVelocity, faireShare, wbcShare, dtcShare,
      faireRevPerUnit, wbcRevPerUnit, dtcRevPerUnit, cogsPerUnit,
      dtcFulfillmentPerUnit, wbcPaymentDays,
      monthlyOpex, wayflierBiweekly, inventoryOnHand,
      tubeLeadWeeks, productionLeadWeeks, freightToSabahWeeks,
      minWeeksStock, productionRunSize, tubeOrderSize, tubeCostPer,
      ingredientCostPerUnit, productionCostPerUnit, freightPerRun, tubesOnHand,
    } = inputs;

    const faireUnits = Math.round(weeklyVelocity * faireShare / 100);
    const wbcUnits = Math.round(weeklyVelocity * wbcShare / 100);
    const dtcUnits = Math.round(weeklyVelocity * dtcShare / 100);

    const faireContrib = faireRevPerUnit - cogsPerUnit;
    const wbcContrib = wbcRevPerUnit - cogsPerUnit;
    const dtcContrib = dtcRevPerUnit - cogsPerUnit - dtcFulfillmentPerUnit;

    const weeklyOpex = monthlyOpex / 4.33;
    const weeklyWayflier = wayflierBiweekly / 2;

    const totalLeadWeeks = tubeLeadWeeks + productionLeadWeeks + freightToSabahWeeks;
    const weeksOfStock = inventoryOnHand / weeklyVelocity;
    const reorderWeek = Math.max(0, Math.floor(weeksOfStock - totalLeadWeeks));

    const tubeWeeksOfStock = tubesOnHand / weeklyVelocity;
    const tubeReorderWeek = Math.max(0, Math.floor(tubeWeeksOfStock - tubeLeadWeeks - 2));

    let cashBalance = cashOnHand;
    let inventory = inventoryOnHand;
    let tubes = tubesOnHand;
    const pendingCashIn: { week: number; amount: number }[] = [];
    const productionScheduled: { arriveWeek: number; type: string; qty: number }[] = [];
    const weeklyData: any[] = [];
    const actions: { week: number; type: string; text: string; cost: number; sanityNote?: string }[] = [];
    let tubeOrderPlaced = false;
    let productionPlaced = false;

    for (let w = 0; w < weeks; w++) {
      let weekCashIn = 0;
      let weekCashOut = 0;
      const cashInBreakdown: { label: string; amount: number }[] = [];
      const cashOutBreakdown: { label: string; amount: number }[] = [];

      const unitsSold = Math.min(weeklyVelocity, inventory);
      const faireSold = Math.min(faireUnits, Math.round(unitsSold * faireShare / 100));
      const wbcSold = Math.min(wbcUnits, Math.round(unitsSold * wbcShare / 100));
      const dtcSold = Math.min(dtcUnits, Math.round(unitsSold * dtcShare / 100));

      const faireRev = faireSold * faireRevPerUnit;
      const wbcRev = wbcSold * wbcRevPerUnit;
      const dtcRev = dtcSold * dtcRevPerUnit;
      const weekRevenue = faireRev + wbcRev + dtcRev;

      weekCashIn += faireRev + dtcRev;
      if (faireRev > 0) cashInBreakdown.push({ label: "Faire Revenue", amount: Math.round(faireRev) });
      if (dtcRev > 0) cashInBreakdown.push({ label: "DTC Revenue", amount: Math.round(dtcRev) });

      const wbcPayWeek = w + Math.ceil(wbcPaymentDays / 7);
      if (wbcPayWeek < weeks) {
        pendingCashIn.push({ week: wbcPayWeek, amount: wbcRev });
      }
      pendingCashIn.forEach((p) => { if (p.week === w) { weekCashIn += p.amount; cashInBreakdown.push({ label: "Wholesale (delayed)", amount: Math.round(p.amount) }); } });

      const opexAmt = Math.round(weeklyOpex);
      const wayAmt = Math.round(weeklyWayflier);
      const dtcFulfill = Math.round(dtcSold * dtcFulfillmentPerUnit);
      weekCashOut += weeklyOpex + weeklyWayflier + dtcSold * dtcFulfillmentPerUnit;
      cashOutBreakdown.push({ label: "OpEx", amount: opexAmt });
      cashOutBreakdown.push({ label: "Wayflyer", amount: wayAmt });
      if (dtcFulfill > 0) cashOutBreakdown.push({ label: "DTC Fulfillment", amount: dtcFulfill });
      inventory -= unitsSold;

      // Tube reorder
      if (!tubeOrderPlaced && (w >= tubeReorderWeek || tubes < weeklyVelocity * (tubeLeadWeeks + 4))) {
        const cost = tubeOrderSize * tubeCostPer;
        weekCashOut += cost;
        tubeOrderPlaced = true;
        const tubeWeeksSupply = (tubeOrderSize / weeklyVelocity).toFixed(0);
        const sanityNote = `${tubeOrderSize.toLocaleString()} tubes at current velocity (${weeklyVelocity.toLocaleString()}/wk) = ${tubeWeeksSupply} weeks of tube supply. At $${tubeCostPer}/tube = $${Math.round(cost).toLocaleString()} cash outlay.`;
        actions.push({ week: w, type: "tube_order", text: `Order ${tubeOrderSize.toLocaleString()} tubes — $${cost.toLocaleString()}`, cost, sanityNote });
        cashOutBreakdown.push({ label: `Tube Order (${(tubeOrderSize/1000).toFixed(0)}k)`, amount: Math.round(cost) });
        productionScheduled.push({ arriveWeek: w + tubeLeadWeeks, type: "tubes", qty: tubeOrderSize });
      }

      // Arrivals
      productionScheduled.forEach((ps) => {
        if (ps.arriveWeek === w && ps.type === "tubes") tubes += ps.qty;
        if (ps.arriveWeek === w && ps.type === "finished") inventory += ps.qty;
      });

      // Production reorder
      if (!productionPlaced && (w >= reorderWeek || inventory < weeklyVelocity * minWeeksStock * 0.6)) {
        const totalProdCost = productionRunSize * ingredientCostPerUnit + productionRunSize * productionCostPerUnit + freightPerRun;
        weekCashOut += totalProdCost;
        productionPlaced = true;
        tubes -= productionRunSize;
        actions.push({ week: w, type: "production", text: `Production run — ${productionRunSize.toLocaleString()} units — $${Math.round(totalProdCost).toLocaleString()}`, cost: totalProdCost });
        cashOutBreakdown.push({ label: "COGS — Ingredients", amount: Math.round(productionRunSize * ingredientCostPerUnit) });
        cashOutBreakdown.push({ label: "COGS — Production", amount: Math.round(productionRunSize * productionCostPerUnit) });
        cashOutBreakdown.push({ label: "COGS — Freight", amount: Math.round(freightPerRun) });
        productionScheduled.push({ arriveWeek: w + productionLeadWeeks + freightToSabahWeeks, type: "finished", qty: productionRunSize });
      }

      cashBalance += weekCashIn - weekCashOut;
      const absWeek = startWeekOffset + w;
      const dateStr = weekLabel(absWeek);
      const isCurrent = absWeek === currentWeekIndex();
      weeklyData.push({
        week: absWeek + 1, label: dateStr, isCurrent,
        cashIn: Math.round(weekCashIn), cashOut: Math.round(weekCashOut),
        netCash: Math.round(weekCashIn - weekCashOut), cashBalance: Math.round(cashBalance),
        inventory, tubes, unitsSold, revenue: Math.round(weekRevenue),
        weeksOfStock: inventory > 0 ? +(inventory / weeklyVelocity).toFixed(1) : 0,
        cashInBreakdown, cashOutBreakdown,
      });
    }

    const minCash = Math.min(...weeklyData.map((d) => d.cashBalance));
    const minCashWeek = weeklyData.findIndex((d) => d.cashBalance === minCash) + 1;
    const stockoutAt = weeklyData.findIndex((d) => d.inventory <= 0);
    const weeklyContrib = faireUnits * faireContrib + wbcUnits * wbcContrib + dtcUnits * dtcContrib;
    const blendedContribPerUnit = weeklyContrib / weeklyVelocity;
    const blendedRevPerUnit = (faireShare / 100 * faireRevPerUnit) + (wbcShare / 100 * wbcRevPerUnit) + (dtcShare / 100 * dtcRevPerUnit);
    const blendedMargin = blendedContribPerUnit / blendedRevPerUnit;

    return {
      weeklyData, actions, minCash, minCashWeek, stockoutAt,
      faireContrib, wbcContrib, dtcContrib, blendedContribPerUnit, blendedMargin,
      weeksOfStock, reorderWeek, totalLeadWeeks, weeklyContrib,
      faireUnits, wbcUnits, dtcUnits, weeklyOpex, weeklyWayflier, blendedRevPerUnit,
    };
  }, [inputs, startWeekOffset]);
}

// ── Formatters ──────────────────────────────────────────────────────
const fmt = (n: number) => "$" + Math.round(n).toLocaleString();
const fmtK = (n: number) => n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : "$" + Math.round(n).toLocaleString();

// ── Chart colors (HSL strings matching our design tokens) ───────────
const C_GREEN = "hsl(142, 71%, 45%)";
const C_RED = "hsl(0, 84%, 60%)";
const C_NAVY = "hsl(220, 39%, 20%)";
const C_BLUE = "hsl(199, 89%, 48%)";
const C_GOLD = "hsl(43, 52%, 54%)";
const C_ORANGE = "hsl(38, 92%, 50%)";

// ── Custom tooltip for cash forecast ────────────────────────────────
function CashBreakdownTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-xl px-3 py-2 text-xs max-w-[260px]">
      <div className="font-bold mb-1.5 text-foreground">{label}</div>
      <div className="font-semibold text-foreground mb-1">Cash Balance: {fmt(data.cashBalance)}</div>
      {data.cashInBreakdown?.length > 0 && (
        <div className="mb-1.5">
          <div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase mb-0.5">Inflows ({fmt(data.cashIn)})</div>
          {data.cashInBreakdown.map((item: any, i: number) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono font-semibold" style={{ color: C_GREEN }}>{fmt(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
      {data.cashOutBreakdown?.length > 0 && (
        <div>
          <div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase mb-0.5">Outflows ({fmt(data.cashOut)})</div>
          {data.cashOutBreakdown.map((item: any, i: number) => (
            <div key={i} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono font-semibold" style={{ color: C_RED }}>{fmt(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export function CashPlannerTab() {
  const [inputs, setInputs] = useState<Inputs>(loadSavedInputs);
  const [startWeekOffset, setStartWeekOffset] = useState(() => currentWeekIndex());
  const set = useCallback((key: keyof Inputs) => (val: number) => setInputs((p) => ({ ...p, [key]: val })), []);
  const model = useModel(inputs, startWeekOffset);

  const goBack = () => setStartWeekOffset((o) => o - 4);
  const goForward = () => setStartWeekOffset((o) => o + 4);
  const goToNow = () => setStartWeekOffset(currentWeekIndex());

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    toast({ title: "Inputs saved", description: "Your model inputs have been saved and will persist between sessions." });
  }, [inputs]);

  const handleReset = useCallback(() => {
    const saved = loadSavedInputs();
    setInputs(saved);
    toast({ title: "Inputs refreshed", description: "Restored from last save." });
  }, []);

  return (
    <div className="flex gap-0 -mx-6 -mt-2">
      {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
      <ScrollArea className="w-[270px] min-w-[270px] border-r border-border bg-card px-3.5 py-4" style={{ height: "calc(100vh - 140px)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-widest text-accent">MODEL INPUTS</span>
        </div>
        <div className="flex gap-1.5 mb-4">
          <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <SidebarSection>Starting Position</SidebarSection>
        <InputField label="Cash on Hand" value={inputs.cashOnHand} onChange={set("cashOnHand")} prefix="$" step={500} />
        <InputField label="Finished Units at Sabah" value={inputs.inventoryOnHand} onChange={set("inventoryOnHand")} suffix="units" step={500} />
        <InputField label="Tubes at AES" value={inputs.tubesOnHand} onChange={set("tubesOnHand")} suffix="tubes" step={1000} />

        <SidebarSection>Velocity + Channel Mix</SidebarSection>
        <InputField label="Weekly Velocity" value={inputs.weeklyVelocity} onChange={set("weeklyVelocity")} suffix="units/wk" step={50} />
        <InputField label="Faire %" value={inputs.faireShare} onChange={set("faireShare")} suffix="%" step={5} />
        <InputField label="Wholesale %" value={inputs.wbcShare} onChange={set("wbcShare")} suffix="%" step={5} />
        <InputField label="DTC %" value={inputs.dtcShare} onChange={set("dtcShare")} suffix="%" step={5} />

        <SidebarSection>Unit Economics</SidebarSection>
        <InputField label="Faire Rev/Unit" value={inputs.faireRevPerUnit} onChange={set("faireRevPerUnit")} prefix="$" step={0.05} />
        <InputField label="Wholesale Rev/Unit" value={inputs.wbcRevPerUnit} onChange={set("wbcRevPerUnit")} prefix="$" step={0.05} />
        <InputField label="DTC Rev/Unit" value={inputs.dtcRevPerUnit} onChange={set("dtcRevPerUnit")} prefix="$" step={0.05} />
        <InputField label="COGS/Unit (landed)" value={inputs.cogsPerUnit} onChange={set("cogsPerUnit")} prefix="$" step={0.05} />
        <InputField label="DTC Fulfillment/Unit" value={inputs.dtcFulfillmentPerUnit} onChange={set("dtcFulfillmentPerUnit")} prefix="$" step={0.05} />

        <SidebarSection>Fixed Costs</SidebarSection>
        <InputField label="Monthly OpEx" value={inputs.monthlyOpex} onChange={set("monthlyOpex")} prefix="$" step={500} />
        <InputField label="Wayflyer Bi-weekly" value={inputs.wayflierBiweekly} onChange={set("wayflierBiweekly")} prefix="$" step={50} />

        <SidebarSection>Lead Times</SidebarSection>
        <InputField label="Tube Order to AES" value={inputs.tubeLeadWeeks} onChange={set("tubeLeadWeeks")} suffix="weeks" />
        <InputField label="AES Production" value={inputs.productionLeadWeeks} onChange={set("productionLeadWeeks")} suffix="weeks" />
        <InputField label="AES → Sabah Freight" value={inputs.freightToSabahWeeks} onChange={set("freightToSabahWeeks")} suffix="weeks" />
        <InputField label="Min Stock Buffer" value={inputs.minWeeksStock} onChange={set("minWeeksStock")} suffix="weeks" />

        <SidebarSection>Production</SidebarSection>
        <InputField label="Run Size" value={inputs.productionRunSize} onChange={set("productionRunSize")} suffix="units" step={500} />
        <InputField label="Ingredient Cost/Unit" value={inputs.ingredientCostPerUnit} onChange={set("ingredientCostPerUnit")} prefix="$" step={0.05} />
        <InputField label="Production Cost/Unit" value={inputs.productionCostPerUnit} onChange={set("productionCostPerUnit")} prefix="$" step={0.05} />
        <InputField label="Freight per Run" value={inputs.freightPerRun} onChange={set("freightPerRun")} prefix="$" step={50} />
        <InputField label="Tube Order Size" value={inputs.tubeOrderSize} onChange={set("tubeOrderSize")} suffix="tubes" step={1000} />
        <InputField label="Tube Cost Each" value={inputs.tubeCostPer} onChange={set("tubeCostPer")} prefix="$" step={0.01} />
      </ScrollArea>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <div className="flex-1 px-6 py-4 overflow-y-auto" style={{ height: "calc(100vh - 140px)" }}>
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={goToNow}>
              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Today
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {weekLabel(startWeekOffset)} — {weekLabel(startWeekOffset + 15)}, {format(weekToDate(startWeekOffset + 15), "yyyy")}
          </span>
        </div>

        {/* Metric cards */}
        <div className="flex gap-3 flex-wrap mb-4">
          <MetricCard icon={DollarSign} label="Cash on Hand" value={fmt(inputs.cashOnHand)} sub={`${model.weeksOfStock.toFixed(1)} weeks of stock`} />
          <MetricCard
            icon={AlertTriangle} label="Lowest Cash Point" value={fmtK(model.minCash)}
            sub={weekLabel(startWeekOffset + model.minCashWeek - 1)}
            variant={model.minCash < 5000 ? "danger" : model.minCash < 10000 ? "warning" : "default"}
          />
          <MetricCard icon={TrendingUp} label="Blended Contribution" value={`$${model.blendedContribPerUnit.toFixed(2)}/unit`} sub={`${(model.blendedMargin * 100).toFixed(1)}% margin`} />
          <MetricCard icon={DollarSign} label="Weekly Contribution" value={fmtK(model.weeklyContrib)} sub={`${inputs.weeklyVelocity.toLocaleString()} units/wk`} variant="success" />
          <MetricCard
            icon={Package} label="Stockout Risk"
            value={model.stockoutAt >= 0 ? weekLabel(startWeekOffset + model.stockoutAt) : "None in 16wk"}
            sub={model.stockoutAt >= 0 ? "Will run out of product" : "Inventory covered"}
            variant={model.stockoutAt >= 0 && model.stockoutAt < 8 ? "danger" : "success"}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="forecast" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="forecast">Cash Forecast</TabsTrigger>
            <TabsTrigger value="channels">Channel Mix</TabsTrigger>
            <TabsTrigger value="inventory">Inventory & Timing</TabsTrigger>
            <TabsTrigger value="actions">Action Plan</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Cash Forecast ─────────────────────────── */}
          <TabsContent value="forecast">
            <SectionHeader sub="Cash balance over 16 weeks given current velocity, channel mix, and production spend">CASH BALANCE FORECAST</SectionHeader>
            <Card><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={model.weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} className="fill-muted-foreground" />
                  <Tooltip content={<CashBreakdownTooltip />} />
                  <ReferenceLine y={5000} stroke={C_RED} strokeDasharray="4 4" label={{ value: "DANGER", fill: C_RED, fontSize: 10 }} />
                  <ReferenceLine y={10000} stroke={C_ORANGE} strokeDasharray="4 4" label={{ value: "LOW", fill: C_ORANGE, fontSize: 10 }} />
                  <Bar dataKey="cashIn" name="Cash In" fill={C_GREEN} opacity={0.6} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cashOut" name="Cash Out" fill={C_RED} opacity={0.5} radius={[3, 3, 0, 0]} />
                  <Line dataKey="cashBalance" name="Cash Balance" stroke={C_NAVY} strokeWidth={2.5} dot={{ r: 3, fill: C_NAVY }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent></Card>

            <SectionHeader sub="Net cash each week — watch for spikes when production costs hit">WEEKLY NET CASH FLOW</SectionHeader>
            <Card><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={model.weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
                  <Tooltip formatter={(v: number, name: string) => [fmt(v), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <ReferenceLine y={0} stroke={C_NAVY} strokeWidth={1} />
                  <Bar dataKey="netCash" name="Net Cash Flow" fill={C_BLUE} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>

            <SectionHeader sub="Line-by-line breakdown of weekly inflows and outflows">WEEKLY BREAKDOWN</SectionHeader>
            <Card><CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 font-bold text-muted-foreground">Week</th>
                    <th className="text-left py-1.5 px-2 font-bold" style={{ color: C_GREEN }}>Inflows</th>
                    <th className="text-left py-1.5 px-2 font-bold" style={{ color: C_RED }}>Outflows</th>
                    <th className="text-right py-1.5 px-2 font-bold text-foreground">Net</th>
                    <th className="text-right py-1.5 px-2 font-bold text-foreground">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {model.weeklyData.map((d: any, i: number) => (
                    <tr key={i} className={`border-b border-border/50 ${d.isCurrent ? "bg-accent/10" : ""}`}>
                      <td className={`py-1.5 px-2 font-semibold ${d.isCurrent ? "text-accent" : "text-foreground"}`}>{d.label}</td>
                      <td className="py-1.5 px-2">
                        {d.cashInBreakdown?.map((item: any, j: number) => (
                          <div key={j} className="flex justify-between gap-2">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-mono" style={{ color: C_GREEN }}>{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </td>
                      <td className="py-1.5 px-2">
                        {d.cashOutBreakdown?.map((item: any, j: number) => (
                          <div key={j} className="flex justify-between gap-2">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-mono" style={{ color: C_RED }}>{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold ${d.netCash >= 0 ? "text-foreground" : "text-destructive"}`}>{fmt(d.netCash)}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-semibold ${d.cashBalance < 5000 ? "text-destructive" : "text-foreground"}`}>{fmt(d.cashBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          </TabsContent>

          {/* ── Tab 2: Channel Mix ───────────────────────────── */}
          <TabsContent value="channels">
            <SectionHeader sub="What each channel contributes after COGS and fulfillment">CHANNEL ECONOMICS</SectionHeader>
            <div className="flex gap-4 flex-wrap">
              {[
                { name: "Faire", units: model.faireUnits, rev: inputs.faireRevPerUnit, contrib: model.faireContrib, share: inputs.faireShare, color: C_BLUE, timing: "Immediate on ship" },
                { name: "Wholesale", units: model.wbcUnits, rev: inputs.wbcRevPerUnit, contrib: model.wbcContrib, share: inputs.wbcShare, color: C_ORANGE, timing: `Net ${inputs.wbcPaymentDays} days` },
                { name: "DTC", units: model.dtcUnits, rev: inputs.dtcRevPerUnit, contrib: model.dtcContrib, share: inputs.dtcShare, color: C_GREEN, timing: "1-2 days" },
              ].map((ch) => (
                <Card key={ch.name} className="flex-1 min-w-[220px]">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold" style={{ color: ch.color }}>{ch.name}</span>
                      <Badge variant="outline">{ch.share}%</Badge>
                    </div>
                    {[
                      ["Units/week", ch.units.toLocaleString()],
                      ["Revenue/unit", "$" + ch.rev.toFixed(2)],
                      ["COGS/unit", "$" + inputs.cogsPerUnit.toFixed(2)],
                      ...(ch.name === "DTC" ? [["Fulfillment/unit", "$" + inputs.dtcFulfillmentPerUnit.toFixed(2)]] : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-semibold font-mono">{v}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-muted-foreground">Contribution/unit</span>
                        <span className="font-bold font-mono" style={{ color: ch.contrib > 0 ? C_GREEN : C_RED }}>${ch.contrib.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Margin</span>
                        <span className="font-semibold font-mono">{(ch.contrib / ch.rev * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Weekly $</span>
                        <span className="font-semibold font-mono" style={{ color: C_GREEN }}>{fmt(ch.units * ch.contrib)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Cash timing</span>
                        <span className="font-semibold font-mono">{ch.timing}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <SectionHeader sub="What shifting DTC to 15% would do">CHANNEL MIX SCENARIOS</SectionHeader>
            <Card><CardContent className="p-4 text-sm leading-relaxed">
              {(() => {
                const scenario15 = 0.80 * model.faireContrib + 0.05 * model.wbcContrib + 0.15 * model.dtcContrib;
                const weeklyGain = (scenario15 - model.blendedContribPerUnit) * inputs.weeklyVelocity;
                return (
                  <>
                    <p className="mb-2"><strong>Current:</strong> ${model.blendedContribPerUnit.toFixed(2)}/unit blended = {fmt(model.weeklyContrib)}/week</p>
                    <p className="mb-2"><strong>If DTC grows to 15%</strong> (Faire 80%, WBC 5%, DTC 15%): ${scenario15.toFixed(2)}/unit = +{fmt(weeklyGain)}/week</p>
                    <p className="italic text-muted-foreground">Use the sidebar inputs to model any mix. Charts update instantly.</p>
                  </>
                );
              })()}
            </CardContent></Card>
          </TabsContent>

          {/* ── Tab 3: Inventory & Timing ────────────────────── */}
          <TabsContent value="inventory">
            <SectionHeader sub="Finished product and tube stock over 16 weeks">INVENTORY RUNWAY</SectionHeader>
            <Card><CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={model.weeklyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: "Finished Units", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: "Tubes", angle: 90, position: "insideRight", style: { fontSize: 10 } }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <ReferenceLine yAxisId="left" y={inputs.weeklyVelocity * inputs.minWeeksStock} stroke={C_ORANGE} strokeDasharray="4 4" label={{ value: `${inputs.minWeeksStock}wk buffer`, fill: C_ORANGE, fontSize: 10 }} />
                  <ReferenceLine yAxisId="left" y={0} stroke={C_RED} strokeWidth={2} />
                  <Line yAxisId="left" dataKey="inventory" name="Finished Product" stroke={C_NAVY} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line yAxisId="right" dataKey="tubes" name="Tubes at AES" stroke={C_GOLD} strokeWidth={2} dot={{ r: 2 }} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent></Card>

            <SectionHeader sub="Full timeline from ordering tubes to sellable product at Sabah">PRODUCTION LEAD TIME CHAIN</SectionHeader>
            <Card><CardContent className="p-5">
              <div className="flex items-center gap-0 flex-wrap justify-center">
                {[
                  { label: "Order Tubes", weeks: inputs.tubeLeadWeeks, bg: "bg-accent", cost: fmt(inputs.tubeOrderSize * inputs.tubeCostPer) },
                  { label: "AES Production", weeks: inputs.productionLeadWeeks, bg: "bg-info", cost: fmt(inputs.productionRunSize * (inputs.ingredientCostPerUnit + inputs.productionCostPerUnit)) },
                  { label: "Freight to Sabah", weeks: inputs.freightToSabahWeeks, bg: "bg-warning", cost: fmt(inputs.freightPerRun) },
                ].map((step, i) => (
                  <div key={i} className="flex items-center">
                    <div className={`${step.bg} text-white rounded-lg px-5 py-3 min-w-[130px] text-center`}>
                      <div className="text-[11px] font-bold tracking-wide">{step.label}</div>
                      <div className="text-2xl font-extrabold font-mono">{step.weeks}wk</div>
                      <div className="text-[10px] opacity-85">{step.cost}</div>
                    </div>
                    {i < 2 && <span className="text-xl text-muted-foreground px-1.5">→</span>}
                  </div>
                ))}
                <span className="text-xl text-muted-foreground px-1.5">=</span>
                <div className="bg-foreground text-background rounded-lg px-5 py-3 min-w-[140px] text-center">
                  <div className="text-[11px] font-bold">TOTAL LEAD TIME</div>
                  <div className="text-2xl font-extrabold font-mono">{model.totalLeadWeeks}wk</div>
                  <div className="text-[10px] text-accent">
                    {fmt(inputs.tubeOrderSize * inputs.tubeCostPer + inputs.productionRunSize * (inputs.ingredientCostPerUnit + inputs.productionCostPerUnit) + inputs.freightPerRun)} total
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3.5 bg-accent/10 rounded-lg text-sm leading-relaxed">
                <strong>Translation:</strong> At {inputs.weeklyVelocity.toLocaleString()} units/week, your {inputs.inventoryOnHand.toLocaleString()} units last ~{(inputs.inventoryOnHand / inputs.weeklyVelocity).toFixed(1)} weeks. With {model.totalLeadWeeks} weeks total lead time, you need to kick off the reorder by <strong>{weekLabel(startWeekOffset + Math.max(0, model.reorderWeek))}</strong> to maintain your {inputs.minWeeksStock}-week buffer. The cash hit comes immediately when you order.
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* ── Tab 4: Action Plan ───────────────────────────── */}
          <TabsContent value="actions">
            <SectionHeader sub="What the model triggers based on your inputs">SCHEDULED ACTIONS</SectionHeader>
            {model.actions.length === 0 ? (
              <Card><CardContent className="p-5 text-sm text-muted-foreground">
                No reorder or production actions triggered in this 16-week window. Inventory and tubes appear sufficient.
              </CardContent></Card>
            ) : (
              <div className="flex flex-col gap-2.5">
                {model.actions.map((a, i) => (
                  <Card key={i} className={`border-l-4 ${a.type === "tube_order" ? "border-l-accent" : "border-l-info"}`}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <div className={`text-[11px] font-semibold tracking-wide ${a.type === "tube_order" ? "text-accent" : "text-info"}`}>
                          {weekLabel(startWeekOffset + a.week)} — {a.type === "tube_order" ? "TUBE ORDER" : "PRODUCTION RUN"}
                        </div>
                        <div className="text-sm font-semibold mt-1">{a.text}</div>
                        {a.sanityNote && (
                          <div className="text-[11px] text-muted-foreground mt-1.5 p-2 bg-muted rounded">
                            📐 <strong>Sanity check:</strong> {a.sanityNote}
                          </div>
                        )}
                      </div>
                      <div className="text-lg font-bold font-mono text-destructive">-{fmt(a.cost)}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <SectionHeader sub="L'Isolina 2.0 decision lens applied to current model">CASH PROTECTION</SectionHeader>
            <Card><CardContent className="p-5 space-y-3">
              <div className={`p-3.5 rounded-lg text-sm leading-relaxed border ${
                model.minCash < 5000 ? "bg-destructive/5 border-destructive" :
                model.minCash < 10000 ? "bg-warning/10 border-warning" :
                "bg-success/5 border-success"
              }`}>
                <strong>{model.minCash < 5000 ? "DANGER" : model.minCash < 10000 ? "TIGHT" : "COVERED"}:</strong>{" "}
                Cash hits {fmt(model.minCash)} on {weekLabel(startWeekOffset + model.minCashWeek - 1)}.
                {model.minCash < 5000 && " Below safety floor. Delay production, reduce run size, or accelerate receivables."}
                {model.minCash >= 5000 && model.minCash < 10000 && " Tight but survivable. Avoid discretionary spend around this window."}
                {model.minCash >= 10000 && " Adequate runway to cover production and maintain buffer."}
              </div>

              <div className="p-3.5 rounded-lg bg-muted text-sm leading-relaxed">
                <strong>Weekly math:</strong> {fmt(model.weeklyContrib)} contribution – {fmt(model.weeklyOpex + model.weeklyWayflier)} fixed costs = <strong>{fmt(model.weeklyContrib - model.weeklyOpex - model.weeklyWayflier)}/week net surplus</strong> before production spend.
              </div>

              <div className="p-3.5 rounded-lg bg-accent/10 text-sm leading-relaxed">
                <strong>2.0 Decision Check:</strong> A {inputs.productionRunSize.toLocaleString()}-unit run sells through in ~{(inputs.productionRunSize / inputs.weeklyVelocity).toFixed(1)} weeks at current velocity. If velocity drops 30%, sell-through extends to ~{(inputs.productionRunSize / (inputs.weeklyVelocity * 0.7)).toFixed(1)} weeks. Blended margin is {(model.blendedMargin * 100).toFixed(1)}% — {model.blendedMargin > 0.50 ? "healthy" : "needs attention"}. Revenue converts in 60-90 days? {inputs.productionRunSize / inputs.weeklyVelocity <= 12 ? "Yes." : "Borderline — consider smaller run."}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
