import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Store, Truck, ShoppingBag } from "lucide-react";
import { useState } from "react";

interface Order {
  id: string;
  source: string;
  customer_name: string;
  order_date: string;
  status: string;
  po_number: string | null;
  total_value: number | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_name: string | null;
  quantity: number;
}

interface ChannelTilesProps {
  orders: Order[];
  orderItems: OrderItem[];
}

const channels = [
  { key: "faire", label: "Faire", icon: Store, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { key: "distributor", label: "Distribution", icon: Truck, color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { key: "shopify", label: "Direct-to-Consumer", icon: ShoppingBag, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
];

export const ChannelTiles = ({ orders, orderItems }: ChannelTilesProps) => {
  const [openChannels, setOpenChannels] = useState<Record<string, boolean>>({});

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {channels.map(({ key, label, icon: Icon, color }) => {
        const channelOrders = orders.filter(o => o.source === key);
        const totalUnits = channelOrders.reduce((sum, o) => {
          const items = orderItems.filter(i => i.order_id === o.id);
          return sum + items.reduce((s, i) => s + i.quantity, 0);
        }, 0);

        return (
          <Collapsible key={key} open={openChannels[key]} onOpenChange={(v) => setOpenChannels(prev => ({ ...prev, [key]: v }))}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4" /> {label}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={color}>{channelOrders.length} orders</Badge>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openChannels[key] ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                  {totalUnits > 0 && <p className="text-xs text-muted-foreground mt-1">{totalUnits} total units</p>}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {channelOrders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No open orders</p>
                  ) : (
                    <div className="space-y-2">
                      {channelOrders.map(o => {
                        const items = orderItems.filter(i => i.order_id === o.id);
                        return (
                          <div key={o.id} className="border rounded p-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">{o.customer_name}</span>
                              {o.po_number && <span className="text-xs text-muted-foreground">PO: {o.po_number}</span>}
                            </div>
                            {items.length > 0 && (
                              <ul className="mt-1 text-xs text-muted-foreground">
                                {items.map(i => <li key={i.id}>• {i.quantity}x {i.product_name || "Unknown"}</li>)}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
};
