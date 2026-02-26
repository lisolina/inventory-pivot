import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, fileContent, fileBase64, mimeType, autoCreateOrder } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert at parsing Purchase Orders (POs) for a food/beverage distribution company called L'Isolina / SpaghettiDust.

Your task is to analyze uploaded PO documents and extract structured data.

Common customers: Rainforest Distribution, World's Best Cheeses, Hudson Harvest, Misfits Market, various retail stores.

Common products include pasta products (Radiatore/Radiatoria/Radiatory, Fusilli, Rigatoni, Casarecce, Spaghetti Dust/SpaghettiDust Aglio). Match product names even if spelled differently or with underscores/codes.

Extract:
1. Customer/recipient name
2. PO number
3. PO date
4. Expected delivery date (if present)
5. Products and quantities ordered (match to: Radiatore, Fusilli, Rigatoni, Casarecce, SpaghettiDust Aglio)
6. Any special instructions

Return JSON:
{
  "customer": "Customer Name",
  "poNumber": "PO-12345" or null,
  "poDate": "YYYY-MM-DD" or null,
  "deliveryDate": "YYYY-MM-DD" or null,
  "items": [
    {"product": "Matched Product Name", "quantity": 10, "unit": "cases", "originalDescription": "what appeared on PO"}
  ],
  "notes": "Any special instructions"
}`;

    // Build messages - use multimodal for PDFs
    const messages: any[] = [{ role: "system", content: systemPrompt }];
    
    if (fileBase64 && mimeType) {
      // Multimodal: send PDF/image as base64
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Parse this Purchase Order document (${fileName}). Extract customer, PO number, dates, and line items.` },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `Parse this Purchase Order document.\n\nFile: ${fileName}\n\nContent:\n${fileContent}`
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service requires credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to process document with AI");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    let parsedResult;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedResult = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsedResult = { rawResponse: content, error: "Could not parse structured data" };
    }

    // Auto-create order if requested and parsing succeeded
    let createdOrder = null;
    if (autoCreateOrder && parsedResult.customer && parsedResult.items?.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      const { data: order, error: orderErr } = await sb.from("orders").insert({
        customer_name: parsedResult.customer,
        source: "distributor",
        po_number: parsedResult.poNumber || null,
        delivery_date: parsedResult.deliveryDate || null,
        notes: parsedResult.notes || `Parsed from ${fileName}`,
        status: "new",
      }).select().single();

      if (order && !orderErr) {
        createdOrder = order;
        const items = parsedResult.items.map((item: any) => ({
          order_id: order.id,
          product_name: item.product,
          quantity: item.quantity,
        }));
        await sb.from("order_items").insert(items);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, fileName, result: parsedResult, createdOrder
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error parsing PO:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
