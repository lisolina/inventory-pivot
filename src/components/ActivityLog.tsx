import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, ArrowUpDown, Mail, FileSpreadsheet } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "sync" | "email_approval" | "manual_update";
  description: string;
  timestamp: string;
  status: "success" | "error" | "pending";
}

interface ActivityLogProps {
  activities: ActivityItem[];
}

const activityIcons = {
  sync: ArrowUpDown,
  email_approval: Mail,
  manual_update: FileSpreadsheet,
};

export const ActivityLog = ({ activities }: ActivityLogProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Activity Log</h3>
      </div>
      
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type];
            return (
              <div key={activity.id} className="flex gap-3">
                <div className="p-2 rounded-lg bg-muted h-fit">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.timestamp}
                  </p>
                </div>
                <div
                  className={`h-2 w-2 rounded-full mt-2 ${
                    activity.status === "success"
                      ? "bg-success"
                      : activity.status === "error"
                      ? "bg-destructive"
                      : "bg-warning"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
};
