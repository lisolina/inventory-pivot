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
  quantityUnits: number;
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
  source_name: string;
  note_attributes: Array<{
    name: string;
    value: string;
  }>;
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
    let allOrders: ShopifyOrder[] = [];
    let pageUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/orders.json?status=open&fulfillment_status=unfulfilled&limit=250`;
    
    // Fetch all pages of orders
    while (pageUrl) {
      const response = await fetch(pageUrl, {
        headers: {
          'X-Shopify-Access-Token': shopifyApiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const orders: ShopifyOrder[] = data.orders || [];
      allOrders = allOrders.concat(orders);
      
      console.log(`Fetched ${orders.length} orders (total: ${allOrders.length})`);
      
      // Check for next page in Link header
      const linkHeader = response.headers.get('Link');
      pageUrl = '';
      
      if (linkHeader) {
        const links = linkHeader.split(',');
        for (const link of links) {
          if (link.includes('rel="next"')) {
            const match = link.match(/<([^>]+)>/);
            if (match) {
              pageUrl = match[1];
            }
            break;
          }
        }
      }
    }
    
    console.log(`Fetched total of ${allOrders.length} unfulfilled orders from Shopify`);
    const orders = allOrders;

    // Transform Shopify orders to our PendingOrder format
    const pendingOrders: PendingOrder[] = [];
    
    for (const order of orders) {
      // Determine if this is a Faire order based on source_name
      const isFaireOrder = order.source_name === 'faire';
      
      // Get Faire order number from note_attributes if available
      let faireOrderNumber = null;
      if (isFaireOrder && order.note_attributes) {
        const faireOrderAttr = order.note_attributes.find(attr => 
          attr.name === 'faire_order_id' || attr.name === 'Faire Order ID'
        );
        faireOrderNumber = faireOrderAttr?.value;
      }
      
      // Format date as M/D/YYYY
      const orderDate = new Date(order.created_at);
      const formattedDate = `${orderDate.getMonth() + 1}/${orderDate.getDate()}/${orderDate.getFullYear()}`;
      
      for (const item of order.line_items) {
        // Skip Faire commission and payment processing fees (case-insensitive)
        const itemTitle = item.title.toLowerCase();
        if (itemTitle.includes('commission') || 
            itemTitle.includes('payment processing') ||
            itemTitle.includes('processing fee') ||
            itemTitle.includes('faire commission') ||
            itemTitle.includes('faire payment')) {
          console.log(`Skipping fee item: ${item.title}`);
          continue;
        }
        
        const units = item.quantity;
        const cases = Math.ceil(units / 12); // Round up to nearest case
        
        pendingOrders.push({
          id: `shopify-${order.id}-${item.product_id}`,
          poNumber: isFaireOrder && faireOrderNumber ? faireOrderNumber : `#${order.order_number}`,
          productName: item.title,
          quantityUnits: units,
          quantityCases: cases,
          dateOrdered: formattedDate,
          source: isFaireOrder ? 'faire' : 'shopify',
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

    const emailOrders: PendingOrder[] = (data || []).map(order => {
      const units = order.quantity || 0;
      const cases = Math.ceil(units / 12); // Round up to nearest case
      
      // Format date as M/D/YYYY
      const orderDate = new Date(order.date_received);
      const formattedDate = `${orderDate.getMonth() + 1}/${orderDate.getDate()}/${orderDate.getFullYear()}`;
      
      return {
        id: `email-${order.id}`,
        poNumber: order.po_number || 'No PO#',
        productName: order.product_name,
        quantityUnits: units,
        quantityCases: cases,
        dateOrdered: formattedDate,
        source: 'email',
      };
    });

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

    // Sort by date descending (most recent first)
    pendingOrders.sort((a, b) => new Date(b.dateOrdered).getTime() - new Date(a.dateOrdered).getTime());
    
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
