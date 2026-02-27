import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Package, ShoppingCart, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TasksTile } from "@/components/TasksTile";
import { CashFlowChart } from "@/components/CashFlowChart";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
}

const MetricCard = ({ title, value, icon: Icon, subtitle }: MetricCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-accent" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </CardContent>
  </Card>
);

interface InventorySnapshot {
  product_name: string;
  units_on_hand: string;
  cases_on_hand: string;
}

export const DashboardTab = () => {
  const [metrics, setMetrics] = useState({
    cashOnHand: "—",
    inventoryValue: "—",
    openOrders: "0",
    weekRevenue: "—",
  });
  const [alerts, setAlerts] = useState<string[]>([]);
  const [inventorySnapshot, setInventorySnapshot] = useState<InventorySnapshot[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const [orderCountRes, cashRes, invRes, revenueRes, dueInvRes] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["new", "processing"]),
        supabase.from("cash_entries").select("date, type, amount, balance_after").order("date", { ascending: false }).limit(500),
        supabase.from("inventory_items").select("product_name, units_on_hand, cases_on_hand, stock_value, category"),
        supabase.from("orders").select("total_value").gte("order_date", new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from("invoices").select("customer, amount, due_date").eq("status", "pending").lte("due_date", new Date(Date.now() + 7 * 86400000).toISOString()),
      ]);

      // Inventory snapshot - filter by category (pasta/dust = finished products)
      const finishedItems = (invRes.data || []).filter((item: any) => {
        const cat = ((item as any).category || "").toLowerCase().trim();
        return cat === "pasta" || cat === "dust";
      });
      setInventorySnapshot(finishedItems.map((i: any) => ({
        product_name: i.product_name,
        units_on_hand: i.units_on_hand || "0",
        cases_on_hand: i.cases_on_hand || "0",
      })));

      let totalInvValue = 0;
      finishedItems.forEach((item: any) => {
        const val = parseFloat(item.stock_value?.replace(/[^0-9.-]/g, "") || "0");
        if (!isNaN(val)) totalInvValue += val;
      });

      let weekRevenue = 0;
      revenueRes.data?.forEach((o) => { weekRevenue += Number(o.total_value || 0); });

      const alertList: string[] = [];
      dueInvRes.data?.forEach((inv) => {
        const days = Math.ceil((new Date(inv.due_date).getTime() - Date.now()) / 86400000);
        if (days < 0) alertList.push(`⚠️ ${inv.customer} invoice ($${inv.amount}) is ${Math.abs(days)} days overdue`);
        else if (days <= 2) alertList.push(`🔴 ${inv.customer} invoice ($${inv.amount}) due in ${days} day(s)`);
        else alertList.push(`🟡 ${inv.customer} invoice ($${inv.amount}) due in ${days} days`);
      });

      // Cash on hand: find the most recent entry with balance_after, or compute from entries
      let cashOnHand: number | null = null;
      const cashData = cashRes.data || [];
      // First try: most recent entry with balance_after
      const withBalance = cashData.find((e: any) => e.balance_after !== null);
      if (withBalance) {
        cashOnHand = Number((withBalance as any).balance_after);
      } else if (cashData.length > 0) {
        // Fallback: sum all in/out transactions
        let running = 0;
        // Process oldest first
        const sorted = [...cashData].reverse();
        sorted.forEach((e: any) => {
          if (e.type === "in") running += Number(e.amount);
          else if (e.type === "out") running -= Number(e.amount);
        });
        cashOnHand = running;
      }

      setMetrics({
        cashOnHand: cashOnHand !== null ? `$${cashOnHand.toLocaleString()}` : "—",
        inventoryValue: totalInvValue > 0 ? `$${totalInvValue.toLocaleString()}` : "—",
        openOrders: String(orderCountRes.count || 0),
        weekRevenue: weekRevenue > 0 ? `$${weekRevenue.toLocaleString()}` : "—",
      });
      setAlerts(alertList);
    };

    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Cash on Hand" value={metrics.cashOnHand} icon={DollarSign} subtitle="From latest cash entry" />
        <MetricCard title="Inventory Value" value={metrics.inventoryValue} icon={Package} subtitle="Finished products only" />
        <MetricCard title="Open Orders" value={metrics.openOrders} icon={ShoppingCart} />
        <MetricCard title="This Week's Revenue" value={metrics.weekRevenue} icon={TrendingUp} subtitle="Revenue booked (not cash in)" />
      </div>

      {/* Inventory Snapshot */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            Inventory Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inventorySnapshot.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inventory data. Sync from Google Sheets in the Inventory tab.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventorySnapshot.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                    <TableCell className="text-right text-sm">{item.units_on_hand}</TableCell>
                    <TableCell className="text-right text-sm">{item.cases_on_hand}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tasks + Alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <TasksTile />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Alerts & Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No alerts right now. You're all caught up! 🎉</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((alert, i) => (
                  <li key={i} className="text-sm border-b border-border pb-2 last:border-0">{alert}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <CashFlowChart />
    </div>
  );
};
