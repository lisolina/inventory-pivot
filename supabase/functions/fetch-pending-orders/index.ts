import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PendingOrder {
  id: string;
  poNumber: string;
  productName: string;
  quantityCases: number;
  dateOrdered: string;
  source: "faire" | "shopify" | "email";
}

interface ShopifyOrder {
  id: string;
  order_number: string;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  line_items: Array<{
    title: string;
    quantity: number;
    product_id: number;
  }>;
}

async function fetchShopifyOrders(): Promise<PendingOrder[]> {
  const shopifyApiKey = Deno.env.get('SHOPIFY_ADMIN_API_KEY');
  const shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
  
  if (!shopifyApiKey || !shopifyStoreUrl) {
    console.log('Shopify credentials not configured');
    return [];
  }

  try {
    // Fetch unfulfilled orders from Shopify
    const response = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-01/orders.json?status=any&fulfillment_status=unfulfilled`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyApiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const orders: ShopifyOrder[] = data.orders || [];
    
    console.log(`Fetched ${orders.length} unfulfilled orders from Shopify`);

    // Transform Shopify orders to our PendingOrder format
    const pendingOrders: PendingOrder[] = [];
    
    for (const order of orders) {
      for (const item of order.line_items) {
        pendingOrders.push({
          id: `shopify-${order.id}-${item.product_id}`,
          poNumber: `#${order.order_number}`,
          productName: item.title,
          quantityCases: item.quantity,
          dateOrdered: new Date(order.created_at).toISOString().split('T')[0],
          source: 'shopify',
        });
      }
    }

    return pendingOrders;
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    throw error;
  }
}

async function fetchEmailOrders(): Promise<PendingOrder[]> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('email_orders')
      .select('*')
      .eq('processed', false)
      .order('date_received', { ascending: false });

    if (error) {
      console.error('Error fetching email orders:', error);
      return [];
    }

    const emailOrders: PendingOrder[] = (data || []).map(order => ({
      id: `email-${order.id}`,
      poNumber: order.po_number || 'No PO#',
      productName: order.product_name,
      quantityCases: order.quantity,
      dateOrdered: new Date(order.date_received).toISOString().split('T')[0],
      source: 'email',
    }));

    console.log(`Fetched ${emailOrders.length} email orders`);
    return emailOrders;
  } catch (error) {
    console.error('Error fetching email orders:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pendingOrders: PendingOrder[] = [];

    // Fetch orders from Shopify (includes Faire orders via integration)
    try {
      const shopifyOrders = await fetchShopifyOrders();
      pendingOrders.push(...shopifyOrders);
    } catch (error) {
      console.error('Failed to fetch Shopify orders:', error);
    }
    
    // Fetch orders from email
    try {
      const emailOrders = await fetchEmailOrders();
      pendingOrders.push(...emailOrders);
    } catch (error) {
      console.error('Failed to fetch email orders:', error);
    }

    console.log('Total pending orders fetched:', pendingOrders.length);

    return new Response(
      JSON.stringify({ orders: pendingOrders }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
