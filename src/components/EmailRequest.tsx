import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, Package } from "lucide-react";

interface EmailRequestProps {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  items: Array<{ sku: string; quantity: number; name: string }>;
  status: "pending" | "approved" | "rejected";
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export const EmailRequest = ({
  id,
  from,
  subject,
  receivedAt,
  items,
  status,
  onApprove,
  onReject,
}: EmailRequestProps) => {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">{subject}</h4>
            <p className="text-sm text-muted-foreground">From: {from}</p>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{receivedAt}</span>
            </div>
          </div>
        </div>
        <Badge
          className={
            status === "approved"
              ? "bg-success text-success-foreground"
              : status === "rejected"
              ? "bg-destructive text-destructive-foreground"
              : "bg-warning text-warning-foreground"
          }
        >
          {status}
        </Badge>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Package className="h-4 w-4" />
          Inventory Changes:
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="pl-6 text-sm text-muted-foreground">
            {item.name} (SKU: {item.sku}) - Qty: {item.quantity}
          </div>
        ))}
      </div>

      {status === "pending" && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onReject(id)}
            className="flex-1"
          >
            Reject
          </Button>
          <Button onClick={() => onApprove(id)} className="flex-1">
            Approve
          </Button>
        </div>
      )}
    </Card>
  );
};
