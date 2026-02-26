import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { InventoryTable } from "@/components/InventoryTable";

interface FinishedItem {
  id: string;
  product_id: string | null;
  location: string;
  quantity: number;
  reorder_point: number;
  last_updated: string;
  product_name?: string;
}

interface PackagingItem {
  id: string;
  item_name: string;
  location: string;
  quantity: number;
  reorder_point: number;
}

interface ShippingItem {
  id: string;
  item_name: string;
  location: string;
  quantity: number;
  reorder_point: number;
}

export const InventoryTab = () => {
  const { toast } = useToast();
  const [finished, setFinished] = useState<FinishedItem[]>([]);
  const [packaging, setPackaging] = useState<PackagingItem[]>([]);
  const [shipping, setShipping] = useState<ShippingItem[]>([]);
  const [sheetsInventory, setSheetsInventory] = useState<any[]>([]);
  const [sheetsLastSynced, setSheetsLastSynced] = useState<string | undefined>();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", quantity: "0", reorderPoint: "100", tab: "finished", location: "sabah" });

  const fetchAll = async () => {
    const [finRes, packRes, shipRes, sheetsRes] = await Promise.all([
      supabase.from("inventory_finished").select("*").order("last_updated", { ascending: false }),
      supabase.from("inventory_packaging").select("*").order("item_name"),
      supabase.from("inventory_shipping").select("*").order("item_name"),
      supabase.from("inventory_items").select("*").order("last_synced", { ascending: false }).limit(1000),
    ]);

    if (finRes.data) setFinished(finRes.data);
    if (packRes.data) setPackaging(packRes.data);
    if (shipRes.data) setShipping(shipRes.data);
    if (sheetsRes.data && sheetsRes.data.length > 0) {
      setSheetsInventory(sheetsRes.data.map(item => ({
        productName: item.product_name,
        reorderLevel: item.reorder_level || "",
        unitsOnHand: item.units_on_hand || "",
        casesOnHand: item.cases_on_hand || "",
        stockValue: item.stock_value || "",
        reorder: item.reorder || "",
      })));
      setSheetsLastSynced(sheetsRes.data[0].last_synced);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSyncSheets = async () => {
    try {
      toast({ title: "Syncing...", description: "Reading from Google Sheets" });
      const { error } = await supabase.functions.invoke("sync-google-sheets", { body: { action: "read" } });
      if (error) throw error;
      await fetchAll();
      toast({ title: "Sync Complete", description: "Inventory updated from Google Sheets" });
    } catch {
      toast({ title: "Sync Failed", variant: "destructive" });
    }
  };

  const handleAddItem = async () => {
    try {
      const qty = parseInt(newItem.quantity);
      const rp = parseInt(newItem.reorderPoint);

      if (newItem.tab === "finished") {
        // Create product first, then finished inventory
        const { data: product, error: pErr } = await supabase.from("products").insert({ name: newItem.name, sku: newItem.name.toUpperCase().replace(/\s+/g, "-") }).select().single();
        if (pErr) throw pErr;
        const { error } = await supabase.from("inventory_finished").insert({ product_id: product.id, quantity: qty, reorder_point: rp, location: newItem.location });
        if (error) throw error;
      } else if (newItem.tab === "packaging") {
        const { error } = await supabase.from("inventory_packaging").insert({ item_name: newItem.name, quantity: qty, reorder_point: rp, location: newItem.location });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_shipping").insert({ item_name: newItem.name, quantity: qty, reorder_point: rp, location: newItem.location });
        if (error) throw error;
      }

      toast({ title: "Item Added", description: newItem.name });
      setAddDialogOpen(false);
      setNewItem({ name: "", quantity: "0", reorderPoint: "100", tab: "finished", location: "sabah" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const getStatus = (qty: number, reorderPoint: number) => {
    const ratio = qty / reorderPoint;
    if (ratio <= 0.5) return <Badge variant="destructive">Reorder Now</Badge>;
    if (ratio <= 1) return <Badge className="bg-warning text-warning-foreground">Order Soon</Badge>;
    return <Badge className="bg-success text-success-foreground">OK</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Inventory</h2>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select value={newItem.tab} onValueChange={(v) => setNewItem({ ...newItem, tab: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finished">Finished Product</SelectItem>
                    <SelectItem value="packaging">Packaging</SelectItem>
                    <SelectItem value="shipping">Shipping Supplies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Name</Label><Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} /></div>
              <div><Label>Quantity</Label><Input type="number" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} /></div>
              <div><Label>Reorder Point</Label><Input type="number" value={newItem.reorderPoint} onChange={(e) => setNewItem({ ...newItem, reorderPoint: e.target.value })} /></div>
              <div>
                <Label>Location</Label>
                <Select value={newItem.location} onValueChange={(v) => setNewItem({ ...newItem, location: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sabah">Sabah</SelectItem>
                    <SelectItem value="aes">AES</SelectItem>
                    <SelectItem value="sfoglini">Sfoglini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddItem} className="w-full">Add</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="finished">
        <TabsList>
          <TabsTrigger value="finished">Finished Product</TabsTrigger>
          <TabsTrigger value="packaging">Packaging</TabsTrigger>
          <TabsTrigger value="shipping">Shipping Supplies</TabsTrigger>
          <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
        </TabsList>

        <TabsContent value="finished">
          <Card>
            <CardContent className="pt-6">
              {finished.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No finished products yet. Add items or sync from Google Sheets.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">On Hand</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finished.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name || item.product_id}</TableCell>
                        <TableCell className="capitalize">{item.location}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.reorder_point}</TableCell>
                        <TableCell>{getStatus(item.quantity, item.reorder_point)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging">
          <Card>
            <CardContent className="pt-6">
              {packaging.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No packaging items tracked yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packaging.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell className="capitalize">{item.location}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.reorder_point}</TableCell>
                        <TableCell>{getStatus(item.quantity, item.reorder_point)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping">
          <Card>
            <CardContent className="pt-6">
              {shipping.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No shipping supplies tracked yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipping.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell className="capitalize">{item.location}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.reorder_point}</TableCell>
                        <TableCell>{getStatus(item.quantity, item.reorder_point)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sheets">
          <InventoryTable
            items={sheetsInventory}
            onRefresh={handleSyncSheets}
            lastSynced={sheetsLastSynced}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
