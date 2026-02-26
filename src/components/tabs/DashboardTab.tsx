import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TasksTile } from "@/components/TasksTile";

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

export const DashboardTab = () => {
  const [metrics, setMetrics] = useState({
    cashOnHand: "$0",
    inventoryValue: "$0",
    openOrders: "0",
    weekRevenue: "$0",
  });
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      // Fetch open orders count
      const { count: orderCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["new", "processing"]);

      // Fetch latest cash entry
      const { data: cashData } = await supabase
        .from("cash_entries")
        .select("balance_after")
        .order("date", { ascending: false })
        .limit(1);

      // Fetch inventory value from inventory_items (existing Google Sheets data)
      const { data: invData } = await supabase
        .from("inventory_items")
        .select("stock_value");

      let totalInvValue = 0;
      invData?.forEach((item) => {
        const val = parseFloat(item.stock_value?.replace(/[^0-9.-]/g, "") || "0");
        if (!isNaN(val)) totalInvValue += val;
      });

      // Fetch this week's revenue from orders
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: revenueData } = await supabase
        .from("orders")
        .select("total_value")
        .gte("order_date", weekAgo.toISOString());

      let weekRevenue = 0;
      revenueData?.forEach((o) => {
        weekRevenue += Number(o.total_value || 0);
      });

      // Fetch alerts - invoices due within 7 days
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const { data: dueInvoices } = await supabase
        .from("invoices")
        .select("customer, amount, due_date")
        .eq("status", "pending")
        .lte("due_date", nextWeek.toISOString());

      const alertList: string[] = [];
      dueInvoices?.forEach((inv) => {
        const dueDate = new Date(inv.due_date);
        const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) {
          alertList.push(`⚠️ ${inv.customer} invoice ($${inv.amount}) is ${Math.abs(daysUntil)} days overdue`);
        } else if (daysUntil <= 2) {
          alertList.push(`🔴 ${inv.customer} invoice ($${inv.amount}) due in ${daysUntil} day(s)`);
        } else {
          alertList.push(`🟡 ${inv.customer} invoice ($${inv.amount}) due in ${daysUntil} days`);
        }
      });

      setMetrics({
        cashOnHand: cashData?.[0]?.balance_after ? `$${Number(cashData[0].balance_after).toLocaleString()}` : "—",
        inventoryValue: totalInvValue > 0 ? `$${totalInvValue.toLocaleString()}` : "—",
        openOrders: String(orderCount || 0),
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
        <MetricCard title="Cash on Hand" value={metrics.cashOnHand} icon={DollarSign} />
        <MetricCard title="Inventory Value" value={metrics.inventoryValue} icon={Package} />
        <MetricCard title="Open Orders" value={metrics.openOrders} icon={ShoppingCart} />
        <MetricCard title="This Week's Revenue" value={metrics.weekRevenue} icon={TrendingUp} />
      </div>

      {/* Tasks + Alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <TasksTile />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
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
    </div>
  );
};
