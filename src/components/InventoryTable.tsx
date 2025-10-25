import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface InventoryItem {
  productName: string;
  reorderLevel: string;
  unitsOnHand: string;
  casesOnHand: string;
  stockValue: string;
  reorder: string;
}

interface InventoryTableProps {
  items: InventoryItem[];
  onRefresh?: () => void;
  lastSynced?: string;
}

export const InventoryTable = ({ items, onRefresh, lastSynced }: InventoryTableProps) => {
  const [filter, setFilter] = useState("");

  // Filter items based on search input
  const filteredItems = items.filter(item => 
    item.productName.toLowerCase().includes(filter.toLowerCase())
  );

  // Calculate total stock value from filtered items
  const totalStockValue = filteredItems.reduce((sum, item) => {
    const value = item.stockValue.replace(/[^0-9.-]/g, '');
    return sum + (parseFloat(value) || 0);
  }, 0);

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No inventory data available. Click "Sync Now" on Google Sheets to load inventory.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Current Inventory (Pasta & Dust)</CardTitle>
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                className="h-8 w-8"
                title="Sync from Google Sheets"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {lastSynced && (
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date(lastSynced).toLocaleString()}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Stock Value</p>
            <p className="text-2xl font-bold">${totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input 
            placeholder="Filter products..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead className="text-right">Units on Hand</TableHead>
                <TableHead className="text-right">Cases on Hand</TableHead>
                <TableHead className="text-right">Stock Value</TableHead>
                <TableHead className="text-center">Reorder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item, index) => (
                <TableRow 
                  key={`${item.productName}-${index}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => window.open('https://docs.google.com/spreadsheets/d/1OgqxbZYGaMVWEHJ_up-_F3fBzhaNJ8I-7jT9vhvUFwI/edit?gid=0#gid=0', '_blank')}
                >
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="text-right">{item.reorderLevel}</TableCell>
                  <TableCell className="text-right">{item.unitsOnHand}</TableCell>
                  <TableCell className="text-right">{item.casesOnHand}</TableCell>
                  <TableCell className="text-right">{item.stockValue}</TableCell>
                  <TableCell className="text-center">
                    {item.reorder === "Yes" && (
                      <Badge variant="destructive">Reorder</Badge>
                    )}
                    {item.reorder === "No" && (
                      <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">In Stock</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
