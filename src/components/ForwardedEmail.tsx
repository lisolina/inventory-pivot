import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface ForwardedEmailProps {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: string;
  onConvertToOrder: (id: string) => void;
  onMarkAsTask: (id: string, notes: string) => void;
}

export const ForwardedEmail = ({
  id,
  from,
  subject,
  body,
  receivedAt,
  status,
  onConvertToOrder,
  onMarkAsTask,
}: ForwardedEmailProps) => {
  const [notes, setNotes] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{subject}</CardTitle>
            <CardDescription>
              From: {from} • {new Date(receivedAt).toLocaleString()}
            </CardDescription>
          </div>
          <Badge variant={status === "pending" ? "secondary" : "outline"}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mb-2"
            >
              {isExpanded ? "Hide" : "Show"} Email Body
            </Button>
            {isExpanded && (
              <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                {body}
              </div>
            )}
          </div>

          {status === "pending" && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Notes (optional)
                </label>
                <Textarea
                  placeholder="Add notes or task details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => onConvertToOrder(id)}
                  variant="default"
                >
                  Convert to Order
                </Button>
                <Button
                  onClick={() => onMarkAsTask(id, notes)}
                  variant="secondary"
                >
                  Mark as Task
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
