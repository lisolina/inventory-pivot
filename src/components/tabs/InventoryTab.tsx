import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SheetItem {
  product_name: string;
  category: string | null;
  sku: string | null;
  reorder_level: string | null;
  units_on_hand: string | null;
  cases_on_hand: string | null;
  stock_value: string | null;
  reorder: string | null;
  last_synced: string;
}

export const InventoryTab = () => {
  const { toast } = useToast();
  const [allItems, setAllItems] = useState<SheetItem[]>([]);
  const [lastSynced, setLastSynced] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [shipping, setShipping] = useState<any[]>([]);

  const fetchAll = async () => {
    const [sheetsRes, shipRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("product_name"),
      supabase.from("inventory_shipping").select("*").order("item_name"),
    ]);
    if (sheetsRes.data) {
      setAllItems(sheetsRes.data as any);
      if (sheetsRes.data.length > 0) setLastSynced(sheetsRes.data[0].last_synced);
    }
    if (shipRes.data) setShipping(shipRes.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      toast({ title: "Syncing...", description: "Reading from Google Sheets" });
      const { error } = await supabase.functions.invoke("sync-google-sheets", { body: { action: "read" } });
      if (error) throw error;
      await fetchAll();
      toast({ title: "Sync Complete", description: "Inventory updated from Google Sheets" });
    } catch {
      toast({ title: "Sync Failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // Filter by category column from the spreadsheet
  const finishedItems = allItems.filter((item) => {
    const cat = (item.category || "").toLowerCase().trim();
    return cat === "pasta" || cat === "dust";
  });

  const packagingItems = allItems.filter((item) => {
    const cat = (item.category || "").toLowerCase().trim();
    return cat === "packaging";
  });

  const totalStockValue = finishedItems.reduce((sum, item) => {
    const val = parseFloat(item.stock_value?.replace(/[^0-9.-]/g, "") || "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const getReorderBadge = (reorder: string | null) => {
    if (!reorder) return null;
    const r = reorder.trim().toLowerCase();
    if (r === "yes" || r === "true") return <Badge variant="destructive">Reorder</Badge>;
    return <Badge className="bg-success text-success-foreground">OK</Badge>;
  };

  const renderSheetTable = (items: SheetItem[], showCases = true) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Units</TableHead>
          {showCases && <TableHead className="text-right">Cases</TableHead>}
          <TableHead className="text-right">Stock Value</TableHead>
          <TableHead>Reorder Level</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{item.product_name}</TableCell>
            <TableCell className="text-right">{item.units_on_hand || "—"}</TableCell>
            {showCases && <TableCell className="text-right">{item.cases_on_hand || "—"}</TableCell>}
            <TableCell className="text-right">{item.stock_value || "—"}</TableCell>
            <TableCell>{item.reorder_level || "—"}</TableCell>
            <TableCell>{getReorderBadge(item.reorder)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Inventory</h2>
        <div className="flex items-center gap-3">
          {lastSynced && (
            <span className="text-xs text-muted-foreground">
              Last synced: {new Date(lastSynced).toLocaleString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync Sheets
          </Button>
        </div>
      </div>

      <Tabs defaultValue="finished">
        <TabsList>
          <TabsTrigger value="finished">Finished Product</TabsTrigger>
          <TabsTrigger value="packaging">Packaging</TabsTrigger>
          <TabsTrigger value="shipping">Shipping Supplies</TabsTrigger>
        </TabsList>

        <TabsContent value="finished">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Finished Products</CardTitle>
              {totalStockValue > 0 && (
                <span className="text-sm font-semibold text-accent">
                  Total Value: ${totalStockValue.toLocaleString()}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {finishedItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No finished products found. Click "Sync Sheets" to pull from Google Sheets.
                </p>
              ) : (
                renderSheetTable(finishedItems)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packaging">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Packaging Components</CardTitle>
            </CardHeader>
            <CardContent>
              {packagingItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No packaging items found. Sync from Google Sheets — items with category "Packaging" will appear here.
                </p>
              ) : (
                renderSheetTable(packagingItems, false)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipping Supplies</CardTitle>
            </CardHeader>
            <CardContent>
              {shipping.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No shipping supplies tracked yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipping.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell className="capitalize">{item.location}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.reorder_point}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
