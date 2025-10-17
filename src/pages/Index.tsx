import { useState } from "react";
import { IntegrationCard } from "@/components/IntegrationCard";
import { EmailRequest } from "@/components/EmailRequest";
import { ActivityLog } from "@/components/ActivityLog";
import { FileSpreadsheet, ShoppingBag, Mail, Box } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface EmailRequestData {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  items: Array<{ sku: string; quantity: number; name: string }>;
  status: "pending" | "approved" | "rejected";
}

const Index = () => {
  const { toast } = useToast();
  const [emailRequests, setEmailRequests] = useState<EmailRequestData[]>([
    {
      id: "1",
      from: "supplier@distributor.com",
      subject: "Weekly Inventory Update - 50 units",
      receivedAt: "2 hours ago",
      items: [
        { sku: "PROD-001", quantity: -25, name: "Product A" },
        { sku: "PROD-002", quantity: -15, name: "Product B" },
        { sku: "PROD-003", quantity: -10, name: "Product C" },
      ],
      status: "pending",
    },
    {
      id: "2",
      from: "orders@partner.com",
      subject: "Bulk Order Confirmation",
      receivedAt: "5 hours ago",
      items: [
        { sku: "PROD-004", quantity: -100, name: "Product D" },
      ],
      status: "approved",
    },
  ]);

  const [activities] = useState([
    {
      id: "1",
      type: "sync" as const,
      description: "Google Sheets synced to Shopify - 150 products updated",
      timestamp: "10 minutes ago",
      status: "success" as const,
    },
    {
      id: "2",
      type: "email_approval" as const,
      description: "Approved distributor request from orders@partner.com",
      timestamp: "1 hour ago",
      status: "success" as const,
    },
    {
      id: "3",
      type: "manual_update" as const,
      description: "Manual inventory adjustment in Google Sheets",
      timestamp: "3 hours ago",
      status: "success" as const,
    },
    {
      id: "4",
      type: "sync" as const,
      description: "Faire inventory sync completed",
      timestamp: "5 hours ago",
      status: "success" as const,
    },
  ]);

  const handleApprove = (id: string) => {
    setEmailRequests((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, status: "approved" as const } : req
      )
    );
    toast({
      title: "Request Approved",
      description: "Inventory will be updated in Google Sheets and synced to Shopify.",
    });
  };

  const handleReject = (id: string) => {
    setEmailRequests((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, status: "rejected" as const } : req
      )
    );
    toast({
      title: "Request Rejected",
      description: "No inventory changes will be made.",
      variant: "destructive",
    });
  };

  const handleSync = async (integration: string) => {
    if (integration === "Google Sheets") {
      try {
        toast({
          title: "Sync Started",
          description: "Reading inventory from Google Sheets...",
        });

        const { data, error } = await supabase.functions.invoke('sync-google-sheets', {
          body: { action: 'read', range: 'Sheet1!A:Z' }
        });

        if (error) throw error;

        console.log('Google Sheets data:', data);
        
        toast({
          title: "Sync Complete",
          description: "Successfully synced inventory data from Google Sheets",
        });
      } catch (error) {
        console.error('Sync error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to sync with Google Sheets';
        toast({
          title: "Sync Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Sync Started",
        description: `${integration} sync initiated...`,
      });
    }
  };

  const handleConfigure = (integration: string) => {
    toast({
      title: "Configuration",
      description: `Opening ${integration} configuration...`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">Inventory Management System</h1>
          <p className="text-muted-foreground">
            Centralized inventory sync across Google Sheets, Shopify, Email, and Faire
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="emails">
              Email Requests
              {emailRequests.filter((r) => r.status === "pending").length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-warning text-warning-foreground">
                  {emailRequests.filter((r) => r.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Integrations</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <IntegrationCard
                  title="Google Sheets"
                  description="Primary inventory source"
                  icon={FileSpreadsheet}
                  status="connected"
                  lastSync="10 minutes ago"
                  onConfigure={() => handleConfigure("Google Sheets")}
                  onSync={() => handleSync("Google Sheets")}
                />
                <IntegrationCard
                  title="Shopify"
                  description="E-commerce inventory sync"
                  icon={ShoppingBag}
                  status="connected"
                  lastSync="10 minutes ago"
                  onConfigure={() => handleConfigure("Shopify")}
                  onSync={() => handleSync("Shopify")}
                />
                <IntegrationCard
                  title="Email (Distributors)"
                  description="Process distributor orders"
                  icon={Mail}
                  status="connected"
                  lastSync="2 hours ago"
                  onConfigure={() => handleConfigure("Email")}
                />
                <IntegrationCard
                  title="Faire"
                  description="Wholesale marketplace sync"
                  icon={Box}
                  status="disconnected"
                  onConfigure={() => handleConfigure("Faire")}
                />
              </div>
            </div>

            <ActivityLog activities={activities} />
          </TabsContent>

          <TabsContent value="emails" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-4">Distributor Email Requests</h2>
              <div className="space-y-4">
                {emailRequests.map((request) => (
                  <EmailRequest
                    key={request.id}
                    {...request}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
