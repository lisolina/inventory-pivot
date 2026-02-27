import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Plus, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { POUploader } from "@/components/POUploader";
import { ForwardedEmail } from "@/components/ForwardedEmail";
import { NLOrderInput } from "@/components/NLOrderInput";
import { ChannelTiles } from "@/components/ChannelTiles";

interface Order {
  id: string;
  source: string;
  customer_name: string;
  order_date: string;
  status: string;
  po_number: string | null;
  total_value: number | null;
  tracking_number: string | null;
  carrier: string | null;
  invoice_status: string | null;
  notes: string | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_name: string | null;
  quantity: number;
}

type VelocityRange = "week" | "month" | "quarter" | "year";

const statusColors: Record<string, string> = {
  new: "bg-info text-info-foreground",
  processing: "bg-warning text-warning-foreground",
  shipped: "bg-accent text-accent-foreground",
  delivered: "bg-success text-success-foreground",
  invoiced: "bg-primary text-primary-foreground",
  paid: "bg-success text-success-foreground",
};

const velocityConfig = {
  totalUnits: { label: "Total Units", color: "hsl(var(--accent))" },
};

export const OrdersTab = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [forwardedEmails, setForwardedEmails] = useState<any[]>([]);
  const [velocityRange, setVelocityRange] = useState<VelocityRange>("month");
  const [newOrder, setNewOrder] = useState({
    source: "distributor", customer_name: "", po_number: "", total_value: "", notes: "",
  });

  const fetchOrders = async () => {
    const [ordersRes, itemsRes] = await Promise.all([
      supabase.from("orders").select("*").order("order_date", { ascending: false }),
      supabase.from("order_items").select("*"),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (itemsRes.data) setOrderItems(itemsRes.data);
  };

  const fetchEmails = async () => {
    const { data } = await supabase.from("forwarded_emails").select("*").order("received_at", { ascending: false });
    if (data) setForwardedEmails(data);
  };

  useEffect(() => { fetchOrders(); fetchEmails(); }, []);

  const openOrders = orders.filter((o) => ["new", "processing", "shipped"].includes(o.status));
  const fulfilledOrders = orders.filter((o) => ["delivered", "invoiced", "paid"].includes(o.status));

  const velocityData = useMemo(() => {
    const now = new Date();
    const start = new Date();
    if (velocityRange === "week") start.setDate(now.getDate() - 7);
    else if (velocityRange === "month") start.setDate(now.getDate() - 30);
    else if (velocityRange === "quarter") start.setMonth(now.getMonth() - 3);
    else start.setFullYear(now.getFullYear() - 1);

    const relevant = orders.filter((o) => new Date(o.order_date) >= start);
    const byDate: Record<string, number> = {};
    relevant.forEach((o) => {
      const day = new Date(o.order_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      byDate[day] = (byDate[day] || 0) + Number(o.total_value || 0);
    });
    return Object.entries(byDate).map(([date, totalUnits]) => ({ date, totalUnits }));
  }, [orders, velocityRange]);

  const handleAddOrder = async () => {
    try {
      const { error } = await supabase.from("orders").insert({
        source: newOrder.source, customer_name: newOrder.customer_name,
        po_number: newOrder.po_number || null,
        total_value: newOrder.total_value ? parseFloat(newOrder.total_value) : null,
        notes: newOrder.notes || null,
      });
      if (error) throw error;
      toast({ title: "Order Added" });
      setAddOpen(false);
      setNewOrder({ source: "distributor", customer_name: "", po_number: "", total_value: "", notes: "" });
      fetchOrders();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "paid") updates.payment_date = new Date().toISOString();
    if (status === "shipped") updates.ship_date = new Date().toISOString();
    if (status === "delivered") updates.delivery_date = new Date().toISOString();
    if (status === "invoiced") updates.invoice_status = "invoiced";
    await supabase.from("orders").update(updates).eq("id", id);
    fetchOrders();
    toast({ title: "Status Updated" });
  };

  const handleConvertToOrder = async (id: string) => {
    // Find the email
    const email = forwardedEmails.find(e => e.id === id);
    if (!email) return;

    // Use AI to parse the email body and create an order
    try {
      const { data, error } = await supabase.functions.invoke("parse-email-order", {
        body: { text: `${email.email_subject}\n\n${email.email_body || ""}`, emailFrom: email.email_from, autoCreate: true },
      });
      if (error) throw error;

      await supabase.from("forwarded_emails").update({ status: "converted_to_order" }).eq("id", id);
      fetchEmails();
      fetchOrders();
      toast({ title: "Converted to Order", description: data?.order ? `Created order for ${data.order.customer_name}` : "Email marked as converted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleMarkAsTask = async (id: string, notes: string) => {
    await supabase.from("forwarded_emails").update({ status: "marked_as_task", notes }).eq("id", id);
    fetchEmails();
    toast({ title: "Marked as Task" });
  };

  const renderOrderTable = (items: Order[], emptyMsg: string) => (
    <Card>
      <CardContent className="pt-6">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">{emptyMsg}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Customer</TableHead>
                  <TableHead>PO #</TableHead><TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead><TableHead>Invoice</TableHead><TableHead>Doc</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(order.order_date).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize text-sm">{order.source}</TableCell>
                    <TableCell className="font-medium text-sm">{order.customer_name}</TableCell>
                    <TableCell className="text-sm">{order.po_number || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{order.total_value ? `$${Number(order.total_value).toLocaleString()}` : "—"}</TableCell>
                    <TableCell><Badge className={statusColors[order.status] || ""}>{order.status}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {order.invoice_status === "invoiced" ? "Invoiced" : order.status === "paid" ? "Paid" : "Not Invoiced"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(order as any).file_url ? (
                        <a href={(order as any).file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Select value={order.status} onValueChange={(v) => handleUpdateStatus(order.id, v)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["new", "processing", "shipped", "delivered", "invoiced", "paid"].map((s) => (
                            <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const velocityRanges: { key: VelocityRange; label: string }[] = [
    { key: "week", label: "1W" }, { key: "month", label: "1M" },
    { key: "quarter", label: "3M" }, { key: "year", label: "1Y" },
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="open">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="open">Open Orders ({openOrders.length})</TabsTrigger>
            <TabsTrigger value="fulfilled">Fulfilled ({fulfilledOrders.length})</TabsTrigger>
            <TabsTrigger value="velocity">Velocity</TabsTrigger>
            <TabsTrigger value="email-pos">
              Email POs
              {forwardedEmails.filter((e) => e.status === "pending").length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-warning text-warning-foreground">
                  {forwardedEmails.filter((e) => e.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upload-po">Upload PO</TabsTrigger>
          </TabsList>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Order</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Order</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Source</Label>
                  <Select value={newOrder.source} onValueChange={(v) => setNewOrder({ ...newOrder, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="faire">Faire</SelectItem>
                      <SelectItem value="shopify">Shopify</SelectItem>
                      <SelectItem value="distributor">Distributor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Customer</Label><Input value={newOrder.customer_name} onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })} /></div>
                <div><Label>PO Number</Label><Input value={newOrder.po_number} onChange={(e) => setNewOrder({ ...newOrder, po_number: e.target.value })} /></div>
                <div><Label>Total Value ($)</Label><Input type="number" value={newOrder.total_value} onChange={(e) => setNewOrder({ ...newOrder, total_value: e.target.value })} /></div>
                <div><Label>Notes</Label><Textarea value={newOrder.notes} onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })} /></div>
                <Button onClick={handleAddOrder} className="w-full">Add Order</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="open" className="mt-4 space-y-4">
          <NLOrderInput onOrderCreated={fetchOrders} />
          <ChannelTiles orders={openOrders} orderItems={orderItems} />
          <h3 className="text-lg font-semibold">All Open Orders</h3>
          {renderOrderTable(openOrders, "No open orders right now.")}
        </TabsContent>

        <TabsContent value="fulfilled" className="mt-4">
          <h3 className="text-lg font-semibold mb-3">Fulfilled / Past Orders</h3>
          {renderOrderTable(fulfilledOrders, "No fulfilled orders yet.")}
        </TabsContent>

        <TabsContent value="velocity" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Sales Velocity</CardTitle>
              <div className="flex gap-1">
                {velocityRanges.map((r) => (
                  <Button key={r.key} size="sm" variant={velocityRange === r.key ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setVelocityRange(r.key)}>
                    {r.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {velocityData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No order data for this period.</p>
              ) : (
                <ChartContainer config={velocityConfig} className="h-[300px] w-full">
                  <LineChart data={velocityData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="totalUnits" stroke="var(--color-totalUnits)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-pos" className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold">Forwarded Email POs</h3>
          {forwardedEmails.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No forwarded emails yet.</CardContent></Card>
          ) : (
            forwardedEmails.map((email) => (
              <ForwardedEmail key={email.id} id={email.id} from={email.email_from} subject={email.email_subject} body={email.email_body || ""} receivedAt={email.received_at} status={email.status} onConvertToOrder={handleConvertToOrder} onMarkAsTask={handleMarkAsTask} />
            ))
          )}
        </TabsContent>

        <TabsContent value="upload-po" className="mt-4">
          <POUploader onOrderCreated={fetchOrders} onAddTask={async (title, description) => {
            try {
              await supabase.from("tasks").insert({ title, description, source: "po_upload", status: "pending", priority: "medium" });
              toast({ title: "Task Added", description: title });
            } catch {
              toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
            }
          }} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
