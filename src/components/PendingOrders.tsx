import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, ShoppingBag, Box, Loader2, ChevronDown } from "lucide-react";

interface PendingOrder {
  id: string;
  poNumber: string;
  productName: string;
  quantityUnits: number;
  quantityCases: number;
  dateOrdered: string;
  source: "faire" | "shopify" | "email";
}

interface PendingOrdersProps {
  orders: PendingOrder[];
  isLoading?: boolean;
}

export const PendingOrders = ({ orders, isLoading = false }: PendingOrdersProps) => {
  const [showAll, setShowAll] = useState(false);
  const displayedOrders = showAll ? orders : orders.slice(0, 10);
  const hasMore = orders.length > 10;

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
                <TableHead className="text-right">Qty (Units)</TableHead>
                <TableHead className="text-right">Qty (Cases)</TableHead>
                <TableHead>Date Ordered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No pending orders
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {displayedOrders.map((order) => (
                    <TableRow 
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => window.open('https://admin.shopify.com/store/lisolina/orders', '_blank')}
                    >
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
                      <TableCell className="text-right">{order.quantityUnits}</TableCell>
                      <TableCell className="text-right">{order.quantityCases}</TableCell>
                      <TableCell>{order.dateOrdered}</TableCell>
                    </TableRow>
                  ))}
                  {hasMore && !showAll && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        <Button 
                          variant="ghost" 
                          onClick={() => setShowAll(true)}
                          className="w-full"
                        >
                          <ChevronDown className="w-4 h-4 mr-2" />
                          Show {orders.length - 10} more orders
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
