import { useState, useEffect } from "react";
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
import { Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { POUploader } from "@/components/POUploader";
import { ForwardedEmail } from "@/components/ForwardedEmail";

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

const statusColors: Record<string, string> = {
  new: "bg-info text-info-foreground",
  processing: "bg-warning text-warning-foreground",
  shipped: "bg-accent text-accent-foreground",
  delivered: "bg-success text-success-foreground",
  invoiced: "bg-primary text-primary-foreground",
  paid: "bg-success text-success-foreground",
};

export const OrdersTab = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [forwardedEmails, setForwardedEmails] = useState<any[]>([]);
  const [newOrder, setNewOrder] = useState({
    source: "distributor",
    customer_name: "",
    po_number: "",
    total_value: "",
    notes: "",
  });

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("order_date", { ascending: false });
    if (data) setOrders(data);
  };

  const fetchEmails = async () => {
    const { data } = await supabase.from("forwarded_emails").select("*").order("received_at", { ascending: false });
    if (data) setForwardedEmails(data);
  };

  useEffect(() => {
    fetchOrders();
    fetchEmails();
  }, []);

  const handleAddOrder = async () => {
    try {
      const { error } = await supabase.from("orders").insert({
        source: newOrder.source,
        customer_name: newOrder.customer_name,
        po_number: newOrder.po_number || null,
        total_value: newOrder.total_value ? parseFloat(newOrder.total_value) : null,
        notes: newOrder.notes || null,
      });
      if (error) throw error;
      toast({ title: "Order Added", description: `Order for ${newOrder.customer_name}` });
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
    await supabase.from("forwarded_emails").update({ status: "converted_to_order" }).eq("id", id);
    fetchEmails();
    toast({ title: "Converted to Order" });
  };

  const handleMarkAsTask = async (id: string, notes: string) => {
    await supabase.from("forwarded_emails").update({ status: "marked_as_task", notes }).eq("id", id);
    fetchEmails();
    toast({ title: "Marked as Task" });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">All Orders</TabsTrigger>
          <TabsTrigger value="email-pos">
            Email POs
            {forwardedEmails.filter(e => e.status === "pending").length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-warning text-warning-foreground">
                {forwardedEmails.filter(e => e.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="upload-po">Upload PO</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Orders</h2>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Add Order</Button>
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

          <Card>
            <CardContent className="pt-6">
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No orders yet. Add one or upload a PO.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>PO #</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="whitespace-nowrap">{new Date(order.order_date).toLocaleDateString()}</TableCell>
                          <TableCell className="capitalize">{order.source}</TableCell>
                          <TableCell className="font-medium">{order.customer_name}</TableCell>
                          <TableCell>{order.po_number || "—"}</TableCell>
                          <TableCell className="text-right">{order.total_value ? `$${Number(order.total_value).toLocaleString()}` : "—"}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[order.status] || ""}>{order.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{order.tracking_number || "—"}</TableCell>
                          <TableCell>
                            <Select value={order.status} onValueChange={(v) => handleUpdateStatus(order.id, v)}>
                              <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["new", "processing", "shipped", "delivered", "invoiced", "paid"].map((s) => (
                                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
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
        </TabsContent>

        <TabsContent value="email-pos" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Forwarded Email POs</h3>
              {forwardedEmails.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">No forwarded emails yet.</CardContent></Card>
              ) : (
                forwardedEmails.map((email) => (
                  <ForwardedEmail
                    key={email.id}
                    id={email.id}
                    from={email.email_from}
                    subject={email.email_subject}
                    body={email.email_body || ""}
                    receivedAt={email.received_at}
                    status={email.status}
                    onConvertToOrder={handleConvertToOrder}
                    onMarkAsTask={handleMarkAsTask}
                  />
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="upload-po">
          <POUploader
            onAddTask={async (title, description) => {
              try {
                await supabase.from("tasks").insert({ title, description, source: "po_upload", status: "pending", priority: "medium" });
                toast({ title: "Task Added", description: title });
              } catch {
                toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
