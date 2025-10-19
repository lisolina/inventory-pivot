import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pendingOrders: PendingOrder[] = [];

    // TODO: Fetch orders from Faire API
    // You'll need to add FAIRE_API_KEY secret and implement the Faire API integration
    
    // TODO: Fetch orders from Shopify API
    // You'll need to add SHOPIFY_API_KEY secret and implement the Shopify Orders API
    
    // TODO: Parse emails from orders@lisolinapasta.com
    // You'll need to set up email forwarding/parsing service
    // Options: SendGrid Inbound Parse, Mailgun Routes, or direct IMAP integration

    console.log('Fetched pending orders:', pendingOrders.length);

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
