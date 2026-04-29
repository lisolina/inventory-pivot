import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SortableTableHead, useSort, sortData } from "@/components/SortableTableHead";
import SourceLink from "@/components/SourceLink";

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
  const finishedSort = useSort("units_on_hand", "desc");
  const packagingSort = useSort("units_on_hand", "desc");
  const shippingSort = useSort("quantity", "desc");

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
      try { localStorage.setItem("lastSheetsSync", String(Date.now())); } catch {}
      toast({ title: "Sync Complete", description: "Inventory updated from Google Sheets" });
    } catch {
      toast({ title: "Sync Failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

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

  const sheetGetVal = (item: SheetItem, key: string) => {
    switch (key) {
      case "product_name": return item.product_name;
      case "units_on_hand": return item.units_on_hand;
      case "cases_on_hand": return item.cases_on_hand;
      case "stock_value": return item.stock_value;
      case "reorder_level": return item.reorder_level;
      case "reorder": return item.reorder;
      default: return "";
    }
  };

  const renderSheetTable = (items: SheetItem[], sortHook: ReturnType<typeof useSort>, showCases = true) => {
    const sorted = sortData(items, sortHook.sort, sheetGetVal);
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead label="Product" sortKey="product_name" currentSort={sortHook.sort} onSort={sortHook.handleSort} />
            <SortableTableHead label="Units" sortKey="units_on_hand" currentSort={sortHook.sort} onSort={sortHook.handleSort} className="text-right" />
            {showCases && <SortableTableHead label="Cases" sortKey="cases_on_hand" currentSort={sortHook.sort} onSort={sortHook.handleSort} className="text-right" />}
            <SortableTableHead label="Stock Value" sortKey="stock_value" currentSort={sortHook.sort} onSort={sortHook.handleSort} className="text-right" />
            <SortableTableHead label="Reorder Level" sortKey="reorder_level" currentSort={sortHook.sort} onSort={sortHook.handleSort} />
            <SortableTableHead label="Status" sortKey="reorder" currentSort={sortHook.sort} onSort={sortHook.handleSort} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item, i) => (
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
  };

  const shipGetVal = (item: any, key: string) => {
    switch (key) {
      case "item_name": return item.item_name;
      case "location": return item.location;
      case "quantity": return item.quantity;
      case "reorder_point": return item.reorder_point;
      default: return "";
    }
  };

  const sortedShipping = sortData(shipping, shippingSort.sort, shipGetVal);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          Inventory
          <SourceLink source="inventory" />
        </h2>
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
                renderSheetTable(finishedItems, finishedSort)
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
                renderSheetTable(packagingItems, packagingSort, false)
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
                      <SortableTableHead label="Item" sortKey="item_name" currentSort={shippingSort.sort} onSort={shippingSort.handleSort} />
                      <SortableTableHead label="Location" sortKey="location" currentSort={shippingSort.sort} onSort={shippingSort.handleSort} />
                      <SortableTableHead label="Qty" sortKey="quantity" currentSort={shippingSort.sort} onSort={shippingSort.handleSort} className="text-right" />
                      <SortableTableHead label="Reorder Point" sortKey="reorder_point" currentSort={shippingSort.sort} onSort={shippingSort.handleSort} className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedShipping.map((item: any) => (
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
