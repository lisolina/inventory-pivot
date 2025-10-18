import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InventoryItem {
  productName: string;
  reorderLevel: string;
  unitsOnHand: string;
  stockValue: string;
  reorder: string;
}

interface InventoryTableProps {
  items: InventoryItem[];
}

export const InventoryTable = ({ items }: InventoryTableProps) => {
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
        <CardTitle>Current Inventory (Pasta & Dust)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead className="text-right">Units on Hand</TableHead>
                <TableHead className="text-right">Stock Value</TableHead>
                <TableHead className="text-center">Reorder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={`${item.productName}-${index}`}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="text-right">{item.reorderLevel}</TableCell>
                  <TableCell className="text-right">{item.unitsOnHand}</TableCell>
                  <TableCell className="text-right">{item.stockValue}</TableCell>
                  <TableCell className="text-center">
                    {item.reorder === "Yes" && (
                      <Badge variant="destructive">Reorder</Badge>
                    )}
                    {item.reorder === "No" && (
                      <Badge variant="secondary">In Stock</Badge>
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
