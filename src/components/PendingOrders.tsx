import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, ShoppingBag, Box } from "lucide-react";

interface PendingOrder {
  id: string;
  poNumber: string;
  productName: string;
  quantityCases: number;
  dateOrdered: string;
  source: "faire" | "shopify" | "email";
}

interface PendingOrdersProps {
  orders: PendingOrder[];
}

export const PendingOrders = ({ orders }: PendingOrdersProps) => {
  const getSourceIcon = (source: string) => {
    switch (source) {
      case "faire":
        return <Box className="w-4 h-4" />;
      case "shopify":
        return <ShoppingBag className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "faire":
        return "bg-blue-500/10 text-blue-500";
      case "shopify":
        return "bg-green-500/10 text-green-500";
      case "email":
        return "bg-purple-500/10 text-purple-500";
      default:
        return "bg-muted";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pending Orders</CardTitle>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {orders.length} Orders
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>PO / Order Number</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Qty (Cases)</TableHead>
                <TableHead>Date Ordered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No pending orders
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Badge className={getSourceColor(order.source)}>
                        <span className="flex items-center gap-1">
                          {getSourceIcon(order.source)}
                          {order.source.charAt(0).toUpperCase() + order.source.slice(1)}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{order.poNumber}</TableCell>
                    <TableCell>{order.productName}</TableCell>
                    <TableCell className="text-right">{order.quantityCases}</TableCell>
                    <TableCell>{order.dateOrdered}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
