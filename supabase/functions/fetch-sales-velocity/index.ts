import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductVelocity {
  productName: string;
  totalUnits: number;
  totalCases: number;
  avgUnitsPerDay: number;
  avgCasesPerDay: number;
  source: "faire" | "shopify" | "mixed";
}

interface ShopifyOrder {
  id: string;
  created_at: string;
  source_name: string;
  line_items: Array<{
    title: string;
    quantity: number;
    product_id: number;
  }>;
}

async function fetchShopifyOrders(startDate: Date): Promise<ProductVelocity[]> {
  const shopifyApiKey = Deno.env.get('SHOPIFY_ADMIN_API_KEY');
  const shopifyStoreUrl = Deno.env.get('SHOPIFY_STORE_URL');
  
  if (!shopifyApiKey || !shopifyStoreUrl) {
    console.log('Shopify credentials not configured');
    return [];
  }

  try {
    // Format date for Shopify API
    const createdAtMin = startDate.toISOString();
    
    // Fetch fulfilled orders from Shopify within the time period
    const response = await fetch(
      `https://${shopifyStoreUrl}/admin/api/2024-01/orders.json?status=any&created_at_min=${createdAtMin}&limit=250`,
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
    
    console.log(`Fetched ${orders.length} orders from Shopify since ${createdAtMin}`);

    // Group orders by product and calculate velocity
    const productMap = new Map<string, {
      totalUnits: number;
      totalCases: number;
      sources: Set<string>;
    }>();

    for (const order of orders) {
      const isFaireOrder = order.source_name === 'faire';
      
      for (const item of order.line_items) {
        // Skip Faire commission and payment processing fees
        const itemTitle = item.title.toLowerCase();
        if (itemTitle.includes('commission') || 
            itemTitle.includes('payment processing') ||
            itemTitle.includes('processing fee') ||
            itemTitle.includes('faire commission') ||
            itemTitle.includes('faire payment')) {
          continue;
        }

        const existing = productMap.get(item.title) || {
          totalUnits: 0,
          totalCases: 0,
          sources: new Set<string>(),
        };

        existing.totalUnits += item.quantity;
        existing.totalCases += item.quantity / 12;
        existing.sources.add(isFaireOrder ? 'faire' : 'shopify');

        productMap.set(item.title, existing);
      }
    }

    // Calculate days in period
    const now = new Date();
    const daysInPeriod = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Convert to array and calculate averages
    const velocityData: ProductVelocity[] = Array.from(productMap.entries()).map(([productName, data]) => ({
      productName,
      totalUnits: data.totalUnits,
      totalCases: data.totalCases,
      avgUnitsPerDay: data.totalUnits / daysInPeriod,
      avgCasesPerDay: data.totalCases / daysInPeriod,
      source: data.sources.size > 1 ? 'mixed' : (data.sources.has('faire') ? 'faire' : 'shopify'),
    }));

    // Sort by total units descending
    velocityData.sort((a, b) => b.totalUnits - a.totalUnits);

    return velocityData;
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { period = '30' } = await req.json().catch(() => ({ period: '30' }));
    const days = parseInt(period);
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    console.log(`Fetching sales velocity for the past ${days} days (since ${startDate.toISOString()})`);

    const velocityData = await fetchShopifyOrders(startDate);
    
    console.log(`Calculated velocity for ${velocityData.length} products`);

    return new Response(
      JSON.stringify({ 
        velocityData,
        period: days,
        startDate: startDate.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching sales velocity:', error);
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
