import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ShopifyOrder {
  id: number;
  order_number: number;
  financial_status: string;
  fulfillment_status: string | null;
  created_at: string;
  source_name: string;
  total_price: string;
  note_attributes: Array<{ name: string; value: string }>;
  line_items: Array<{
    title: string;
    quantity: number;
    product_id: number;
    price: string;
  }>;
  customer?: { first_name?: string; last_name?: string; default_address?: { company?: string } };
}

async function fetchShopifyOrdersPage(url: string, apiKey: string): Promise<{ orders: ShopifyOrder[]; nextUrl: string | null }> {
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': apiKey, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
  const data = await response.json();
  const orders: ShopifyOrder[] = data.orders || [];
  
  let nextUrl: string | null = null;
  const linkHeader = response.headers.get('Link');
  if (linkHeader) {
    const links = linkHeader.split(',');
    for (const link of links) {
      if (link.includes('rel="next"')) {
        const match = link.match(/<([^>]+)>/);
        if (match) nextUrl = match[1];
        break;
      }
    }
  }
  return { orders, nextUrl };
}

async function fetchAllShopifyOrders(includeHistorical: boolean): Promise<ShopifyOrder[]> {
  const shopifyApiKey = Deno.env.get('SHOPIFY_ADMIN_API_KEY');
  const shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
  if (!shopifyApiKey || !shopifyStoreUrl) {
    console.log('Shopify credentials not configured');
    return [];
  }

  const allOrders: ShopifyOrder[] = [];
  
  // Fetch unfulfilled orders
  let url: string | null = `https://${shopifyStoreUrl}/admin/api/2025-07/orders.json?status=open&fulfillment_status=unfulfilled&limit=250`;
  while (url) {
    const { orders, nextUrl } = await fetchShopifyOrdersPage(url, shopifyApiKey);
    allOrders.push(...orders);
    url = nextUrl;
  }
  console.log(`Fetched ${allOrders.length} unfulfilled orders`);

  // Fetch historical/fulfilled orders if requested
  if (includeHistorical) {
    let histUrl: string | null = `https://${shopifyStoreUrl}/admin/api/2025-07/orders.json?status=any&fulfillment_status=shipped&limit=250`;
    let histCount = 0;
    while (histUrl && histCount < 500) {
      const { orders, nextUrl } = await fetchShopifyOrdersPage(histUrl, shopifyApiKey);
      allOrders.push(...orders);
      histCount += orders.length;
      histUrl = nextUrl;
    }
    // Also fetch fulfilled
    let fulUrl: string | null = `https://${shopifyStoreUrl}/admin/api/2025-07/orders.json?status=any&fulfillment_status=fulfilled&limit=250`;
    let fulCount = 0;
    while (fulUrl && fulCount < 500) {
      const { orders, nextUrl } = await fetchShopifyOrdersPage(fulUrl, shopifyApiKey);
      allOrders.push(...orders);
      fulCount += orders.length;
      fulUrl = nextUrl;
    }
    console.log(`Fetched ${histCount + fulCount} historical orders`);
  }

  return allOrders;
}

function transformShopifyOrders(orders: ShopifyOrder[]) {
  const result: any[] = [];
  for (const order of orders) {
    const isFaireOrder = order.source_name === 'faire';
    let faireOrderNumber = null;
    if (isFaireOrder && order.note_attributes) {
      const attr = order.note_attributes.find(a => a.name === 'faire_order_id' || a.name === 'Faire Order ID');
      faireOrderNumber = attr?.value;
    }

    const customerName = order.customer?.default_address?.company
      || [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ')
      || 'Unknown';

    const isFulfilled = order.fulfillment_status === 'fulfilled' || order.fulfillment_status === 'shipped';
    
    const items = order.line_items.filter(item => {
      const t = item.title.toLowerCase();
      return !t.includes('commission') && !t.includes('payment processing') && !t.includes('processing fee');
    });

    result.push({
      shopify_id: String(order.id),
      order_number: order.order_number,
      po_number: isFaireOrder && faireOrderNumber ? faireOrderNumber : `#${order.order_number}`,
      customer_name: customerName,
      source: isFaireOrder ? 'faire' : 'shopify',
      order_date: order.created_at,
      total_value: parseFloat(order.total_price) || 0,
      status: isFulfilled ? 'delivered' : 'new',
      items: items.map(i => ({
        product_name: i.title,
        quantity: i.quantity,
        unit_price: parseFloat(i.price) || 0,
      })),
    });
  }
  return result;
}

async function syncOrdersToDb(orders: any[]) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, supabaseKey);

  let synced = 0;
  for (const order of orders) {
    // Check if already exists by po_number + source
    const { data: existing } = await sb.from('orders')
      .select('id')
      .eq('po_number', order.po_number)
      .eq('source', order.source)
      .maybeSingle();

    if (existing) continue; // skip duplicates

    const { data: created, error } = await sb.from('orders').insert({
      customer_name: order.customer_name,
      source: order.source,
      po_number: order.po_number,
      order_date: order.order_date,
      total_value: order.total_value,
      status: order.status,
      notes: `Synced from Shopify #${order.order_number}`,
    }).select().single();

    if (created && !error && order.items?.length > 0) {
      await sb.from('order_items').insert(
        order.items.map((i: any) => ({
          order_id: created.id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }))
      );
      synced++;
    }
  }
  console.log(`Synced ${synced} new orders to database`);
  return synced;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let includeHistorical = false;
    let syncToDb = false;
    try {
      const body = await req.json();
      includeHistorical = body?.includeHistorical ?? false;
      syncToDb = body?.syncToDb ?? false;
    } catch { /* no body is fine */ }

    const shopifyOrders = await fetchAllShopifyOrders(includeHistorical);
    const transformed = transformShopifyOrders(shopifyOrders);

    if (syncToDb && transformed.length > 0) {
      await syncOrdersToDb(transformed);
    }

    // Also fetch email orders
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const { data: emailOrders } = await sb.from('email_orders')
      .select('*').eq('processed', false).order('date_received', { ascending: false });

    const emailPending = (emailOrders || []).map(o => ({
      id: `email-${o.id}`,
      po_number: o.po_number || 'No PO#',
      customer_name: o.email_from,
      product_name: o.product_name,
      quantity: o.quantity || 0,
      order_date: o.date_received,
      source: 'email',
    }));

    return new Response(JSON.stringify({
      orders: transformed,
      emailOrders: emailPending,
      totalShopify: transformed.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
