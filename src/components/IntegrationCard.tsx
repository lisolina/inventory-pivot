import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSync?: string;
  onConfigure: () => void;
  onSync?: () => void;
}

const statusConfig = {
  connected: { label: "Connected", className: "bg-success text-success-foreground" },
  disconnected: { label: "Not Connected", className: "bg-muted text-muted-foreground" },
  syncing: { label: "Syncing", className: "bg-info text-info-foreground" },
  error: { label: "Error", className: "bg-destructive text-destructive-foreground" },
};

export const IntegrationCard = ({
  title,
  description,
  icon: Icon,
  status,
  lastSync,
  onConfigure,
  onSync,
}: IntegrationCardProps) => {
  const statusInfo = statusConfig[status];

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
      </div>
      
      {lastSync && (
        <p className="text-xs text-muted-foreground mb-4">
          Last synced: {lastSync}
        </p>
      )}
      
      <div className="flex gap-2">
        <Button variant="outline" onClick={onConfigure} className="flex-1">
          Configure
        </Button>
        {onSync && status === "connected" && (
          <Button onClick={onSync} className="flex-1">
            Sync Now
          </Button>
        )}
      </div>
    </Card>
  );
};
