import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailWebhook {
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emailData: EmailWebhook = await req.json();
    console.log('Received email:', emailData.subject);

    // Extract PO number from subject (format: PO#123 or PO #123)
    const poMatch = emailData.subject.match(/PO\s*#?\s*(\d+)/i);
    const poNumber = poMatch ? `PO#${poMatch[1]}` : null;

    // Parse email body for product details
    const emailBody = emailData.text || emailData.html || '';
    
    // Simple parsing - look for product names and quantities
    // Format: Product Name - Quantity or Product Name: Quantity
    const productLines = emailBody.split('\n').filter(line => 
      line.includes('-') || line.includes(':')
    );

    const orders = [];
    for (const line of productLines) {
      // Try to extract product and quantity
      const match = line.match(/(.+?)[\-:]\s*(\d+)/);
      if (match) {
        orders.push({
          email_from: emailData.from,
          email_subject: emailData.subject,
          po_number: poNumber,
          product_name: match[1].trim(),
          quantity: parseInt(match[2]),
          raw_email_body: emailBody,
        });
      }
    }

    // If no structured products found, create one entry with the whole email
    if (orders.length === 0 && poNumber) {
      orders.push({
        email_from: emailData.from,
        email_subject: emailData.subject,
        po_number: poNumber,
        product_name: 'Manual Review Required',
        quantity: 0,
        raw_email_body: emailBody,
      });
    }

    // Insert orders into database
    if (orders.length > 0) {
      const { error } = await supabase
        .from('email_orders')
        .insert(orders);

      if (error) {
        console.error('Error inserting email orders:', error);
        throw error;
      }

      console.log(`Stored ${orders.length} order(s) from email`);
    }

    return new Response(
      JSON.stringify({ success: true, orders: orders.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing email:', error);
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
