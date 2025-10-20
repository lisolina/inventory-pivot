import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IntegrationCard } from "@/components/IntegrationCard";
import { EmailRequest } from "@/components/EmailRequest";
import { ForwardedEmail } from "@/components/ForwardedEmail";
import { ActivityLog } from "@/components/ActivityLog";
import { InventoryTable } from "@/components/InventoryTable";
import { PendingOrders } from "@/components/PendingOrders";
import { VelocityTracker } from "@/components/VelocityTracker";
import { FileSpreadsheet, ShoppingBag, Mail, Box, ChevronDown, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Session } from "@supabase/supabase-js";

interface EmailRequestData {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  items: Array<{ sku: string; quantity: number; name: string }>;
  status: "pending" | "approved" | "rejected";
}

interface InventoryItem {
  productName: string;
  reorderLevel: string;
  unitsOnHand: string;
  casesOnHand: string;
  stockValue: string;
  reorder: string;
}

interface PendingOrder {
  id: string;
  poNumber: string;
  productName: string;
  quantityUnits: number;
  quantityCases: number;
  dateOrdered: string;
  source: "faire" | "shopify" | "email";
}

interface ForwardedEmailData {
  id: string;
  email_from: string;
  email_subject: string;
  email_body: string;
  received_at: string;
  status: string;
  notes: string | null;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [forwardedEmails, setForwardedEmails] = useState<ForwardedEmailData[]>([]);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  // Auth check
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };
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

  // Fetch pending orders and forwarded emails on mount
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        setIsLoadingOrders(true);
        const { data, error } = await supabase.functions.invoke('fetch-pending-orders');
        
        if (error) {
          console.error('Error fetching pending orders:', error);
          toast({
            title: "Error",
            description: "Failed to fetch pending orders",
            variant: "destructive",
          });
          return;
        }

        if (data?.orders) {
          setPendingOrders(data.orders);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    const fetchForwardedEmails = async () => {
      try {
        const { data, error } = await supabase
          .from('forwarded_emails')
          .select('*')
          .order('received_at', { ascending: false });

        if (error) {
          console.error('Error fetching forwarded emails:', error);
          return;
        }

        if (data) {
          setForwardedEmails(data);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchPendingOrders();
    fetchForwardedEmails();
  }, [toast]);

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
        
        // Parse the inventory data
        if (data?.data?.values && Array.isArray(data.data.values)) {
          const values = data.data.values;
          // Find the header row (row with "Site", "ProductID", etc.)
          const headerRowIndex = values.findIndex((row: string[]) => 
            row.includes("Site") && row.includes("ProductID")
          );
          
          if (headerRowIndex !== -1 && headerRowIndex < values.length - 1) {
            const parsedInventory: InventoryItem[] = [];
            
            // Parse data rows (skip header and empty rows)
            for (let i = headerRowIndex + 1; i < values.length; i++) {
              const row = values[i];
              // Skip empty rows or rows without a product ID
              if (!row[2] || row[2].trim() === "") continue;
              
              const category = row[12] || ""; // Column M (index 12) is category
              
              // Filter for only Pasta or Dust categories
              if (category !== "Pasta" && category !== "Dust") continue;
              
              parsedInventory.push({
                productName: row[3] || "",
                reorderLevel: row[6] || "",
                unitsOnHand: row[8] || "",
                casesOnHand: row[7] || "",
                stockValue: row[9] || "",
                reorder: row[10] || "",
              });
            }
            
            // Sort by units on hand descending
            parsedInventory.sort((a, b) => {
              const unitsA = parseInt(a.unitsOnHand.replace(/[^0-9-]/g, '')) || 0;
              const unitsB = parseInt(b.unitsOnHand.replace(/[^0-9-]/g, '')) || 0;
              return unitsB - unitsA;
            });
            
            setInventory(parsedInventory);
          }
        }
        
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

  const handleConvertToOrder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('forwarded_emails')
        .update({ status: 'converted_to_order' })
        .eq('id', id);

      if (error) throw error;

      setForwardedEmails(prev =>
        prev.map(email =>
          email.id === id ? { ...email, status: 'converted_to_order' } : email
        )
      );

      toast({
        title: "Success",
        description: "Email converted to order. You can now add it to pending orders.",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to convert email to order",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsTask = async (id: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('forwarded_emails')
        .update({ 
          status: 'marked_as_task',
          notes: notes || null
        })
        .eq('id', id);

      if (error) throw error;

      setForwardedEmails(prev =>
        prev.map(email =>
          email.id === id ? { ...email, status: 'marked_as_task', notes } : email
        )
      );

      toast({
        title: "Success",
        description: "Email marked as task to follow up on.",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to mark email as task",
        variant: "destructive",
      });
    }
  };

  if (!session) {
    return null; // Will redirect to /auth
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(6,81%,55%)]">L'Isolina Inventory Management System</h1>
            <p className="text-muted-foreground">
              Here's what the fuck is up with your whole shit
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="forwarded">
              Forwarded Emails
              {forwardedEmails.filter((e) => e.status === "pending").length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-warning text-warning-foreground">
                  {forwardedEmails.filter((e) => e.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
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
            <PendingOrders 
              orders={pendingOrders} 
              isLoading={isLoadingOrders}
              onRefresh={async () => {
                setIsLoadingOrders(true);
                const { data, error } = await supabase.functions.invoke('fetch-pending-orders');
                if (!error && data?.orders) {
                  setPendingOrders(data.orders);
                  toast({ title: "Success", description: "Pending orders refreshed" });
                }
                setIsLoadingOrders(false);
              }}
            />
            
            <InventoryTable 
              items={inventory}
              onRefresh={() => handleSync("Google Sheets")}
            />
            
            <VelocityTracker />

            <Collapsible open={integrationsOpen} onOpenChange={setIntegrationsOpen}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Integrations</h2>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className={`h-4 w-4 transition-transform ${integrationsOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </Collapsible>

            <ActivityLog activities={activities} />
          </TabsContent>

          <TabsContent value="forwarded" className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Forwarded Emails</h2>
              <p className="text-muted-foreground mb-6">
                Forward emails to your webhook to triage them as orders or tasks.
              </p>
              {forwardedEmails.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No forwarded emails yet. Set up your email forwarding to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {forwardedEmails.map((email) => (
                    <ForwardedEmail
                      key={email.id}
                      id={email.id}
                      from={email.email_from}
                      subject={email.email_subject}
                      body={email.email_body || ''}
                      receivedAt={email.received_at}
                      status={email.status}
                      onConvertToOrder={handleConvertToOrder}
                      onMarkAsTask={handleMarkAsTask}
                    />
                  ))}
                </div>
              )}
            </div>
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
