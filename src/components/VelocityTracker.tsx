import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Box, ShoppingBag, RefreshCw, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductVelocity {
  productName: string;
  totalUnits: number;
  totalCases: number;
  avgUnitsPerDay: number;
  avgCasesPerDay: number;
  source: "faire" | "shopify" | "mixed";
}

interface InventoryItem {
  productName: string;
  unitsOnHand: number;
  casesOnHand: number;
}

interface PendingOrder {
  productName: string;
  quantity: number;
}

type TimePeriod = 7 | 30 | 90 | 180;

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 7, label: "Last Week" },
  { value: 30, label: "Last Month" },
  { value: 90, label: "Last 3 Months" },
  { value: 180, label: "Last 6 Months" },
];

export const VelocityTracker = () => {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>(30);
  const [velocityData, setVelocityData] = useState<ProductVelocity[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchVelocityData();
  }, [selectedPeriod]);

  const fetchVelocityData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch velocity data
      const { data: velocityResponse, error: velocityError } = await supabase.functions.invoke('fetch-sales-velocity', {
        body: { period: selectedPeriod.toString() }
      });

      if (velocityError) {
        console.error('Error fetching velocity data:', velocityError);
        toast({
          title: "Error",
          description: "Failed to fetch sales velocity data",
          variant: "destructive",
        });
        return;
      }

      if (velocityResponse?.velocityData) {
        setVelocityData(velocityResponse.velocityData);
      }

      // Fetch inventory data
      const { data: inventoryResponse, error: inventoryError } = await supabase.functions.invoke('sync-google-sheets');
      
      if (!inventoryError && inventoryResponse?.data) {
        const inventory: InventoryItem[] = inventoryResponse.data.map((row: any[]) => ({
          productName: row[0],
          unitsOnHand: parseFloat(row[6]) || 0,
          casesOnHand: parseFloat(row[7]) || 0,
        }));
        setInventoryData(inventory);
      }

      // Fetch pending orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('email_orders')
        .select('product_name, quantity')
        .eq('processed', false);

      if (!ordersError && ordersData) {
        const pending: PendingOrder[] = ordersData.map(order => ({
          productName: order.product_name || '',
          quantity: order.quantity || 0,
        }));
        setPendingOrders(pending);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales velocity data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "faire":
        return <Box className="w-4 h-4" />;
      case "shopify":
        return <ShoppingBag className="w-4 h-4" />;
      default:
        return <TrendingUp className="w-4 h-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "faire":
        return "bg-blue-500/10 text-blue-500";
      case "shopify":
        return "bg-green-500/10 text-green-500";
      default:
        return "bg-purple-500/10 text-purple-500";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Sales Velocity Tracker
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchVelocityData}
                className="h-8 w-8"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              Track sales performance over time to optimize inventory levels
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {TIME_PERIODS.map((period) => (
              <Button
                key={period.value}
                variant={selectedPeriod === period.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period.value)}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Total Units Sold</TableHead>
                <TableHead className="text-right">Total Cases Sold</TableHead>
                <TableHead className="text-right">Avg Units/Day</TableHead>
                <TableHead className="text-right">Avg Cases/Day</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    Suggested Reorder
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Calculated to maintain 8 weeks of inventory based on average daily sales, minus current inventory and outstanding orders.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : velocityData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No sales data available for this period
                  </TableCell>
                </TableRow>
              ) : (
                velocityData.map((product, index) => {
                  // Calculate suggested reorder level (8 weeks of inventory on hand)
                  const weeksToMaintain = 8;
                  const targetUnits = product.avgUnitsPerDay * weeksToMaintain * 7; // 8 weeks = 56 days
                  
                  // Find current inventory for this product
                  const currentInventory = inventoryData.find(
                    inv => inv.productName.toLowerCase() === product.productName.toLowerCase()
                  );
                  const currentUnits = currentInventory?.unitsOnHand || 0;
                  
                  // Find outstanding orders for this product
                  const outstandingUnits = pendingOrders
                    .filter(order => order.productName.toLowerCase() === product.productName.toLowerCase())
                    .reduce((sum, order) => sum + order.quantity, 0);
                  
                  // Calculate suggested reorder: target - current - outstanding
                  const suggestedReorderUnits = Math.max(0, Math.ceil(targetUnits - currentUnits - outstandingUnits));
                  
                  return (
                    <TableRow key={`${product.productName}-${index}`}>
                      <TableCell className="font-medium">{product.productName}</TableCell>
                      <TableCell>
                        <Badge className={getSourceColor(product.source)}>
                          <span className="flex items-center gap-1">
                            {getSourceIcon(product.source)}
                            {product.source === 'mixed' ? 'Mixed' : 
                             product.source.charAt(0).toUpperCase() + product.source.slice(1)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{product.totalUnits.toFixed(0)}</TableCell>
                      <TableCell className="text-right">{product.totalCases.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{product.avgUnitsPerDay.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{product.avgCasesPerDay.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {suggestedReorderUnits} units
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
