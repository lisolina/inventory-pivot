import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import AIChatWidget from "@/components/AIChatWidget";
import { DashboardTab } from "@/components/tabs/DashboardTab";
import { InventoryTab } from "@/components/tabs/InventoryTab";
import { OrdersTab } from "@/components/tabs/OrdersTab";
import { MoneyTab } from "@/components/tabs/MoneyTab";
import { SalesCRMTab } from "@/components/tabs/SalesCRMTab";
import { DustLaunchTab } from "@/components/tabs/DustLaunchTab";
import { WorldBuildingTab } from "@/components/tabs/WorldBuildingTab";

const Index = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) navigate("/auth");
      }
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">L'Isolina Command Center</h1>
            <p className="text-primary-foreground/70 text-sm">
              Your operational HQ — inventory, orders, and money in one place
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="money">Money</TabsTrigger>
            <TabsTrigger value="sales-crm">Sales CRM</TabsTrigger>
            <TabsTrigger value="dust-launch">Dust Launch HQ</TabsTrigger>
            <TabsTrigger value="world-building">World Building</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab onNavigate={setActiveTab} /></TabsContent>
          <TabsContent value="inventory"><InventoryTab /></TabsContent>
          <TabsContent value="orders"><OrdersTab /></TabsContent>
          <TabsContent value="money"><MoneyTab /></TabsContent>
          <TabsContent value="sales-crm"><SalesCRMTab /></TabsContent>
          <TabsContent value="dust-launch"><DustLaunchTab /></TabsContent>
          <TabsContent value="world-building"><WorldBuildingTab /></TabsContent>
        </Tabs>
        <AIChatWidget />
      </main>
    </div>
  );
};

export default Index;
