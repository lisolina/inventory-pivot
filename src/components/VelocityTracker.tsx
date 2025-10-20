import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Box, ShoppingBag } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchVelocityData();
  }, [selectedPeriod]);

  const fetchVelocityData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-sales-velocity', {
        body: { period: selectedPeriod.toString() }
      });

      if (error) {
        console.error('Error fetching velocity data:', error);
        toast({
          title: "Error",
          description: "Failed to fetch sales velocity data",
          variant: "destructive",
        });
        return;
      }

      if (data?.velocityData) {
        setVelocityData(data.velocityData);
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
                <TableHead className="text-right">Suggested Reorder</TableHead>
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
                  // Calculate suggested reorder level (2 weeks of average daily sales)
                  const suggestedReorderCases = Math.ceil(product.avgCasesPerDay * 14);
                  
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
                          {suggestedReorderCases} cases
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
