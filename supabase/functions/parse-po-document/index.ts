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
    const { filePath, fileName, fileContent } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use AI to parse the PO content and extract actions
    const systemPrompt = `You are an expert at parsing Purchase Orders (POs) for a food/beverage distribution company called L'Isolina. 
    
Your task is to analyze uploaded PO documents and extract actionable tasks.

Common customers include:
- Rainforest Distribution
- Misfits Market  
- Various retail stores and distributors

Common products include various pasta products, sauces, and specialty Italian food items like "Spaghetti Dust".

For each PO, extract:
1. Customer/recipient name
2. Products and quantities ordered
3. Any special instructions or notes
4. Suggested action items

Format your response as JSON with this structure:
{
  "customer": "Customer Name",
  "poNumber": "PO-12345" or null,
  "items": [
    {"product": "Product Name", "quantity": 10, "unit": "cases"}
  ],
  "actions": [
    "Prepare pallet for Customer Name",
    "Ship Product X to Customer Name",
    "Check inventory for Product Y"
  ],
  "notes": "Any special instructions or observations"
}

If the document doesn't appear to be a valid PO, return:
{
  "error": "Could not parse as PO",
  "suggestion": "Brief explanation of what the document appears to be"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Please parse this Purchase Order document.

File name: ${fileName}

Document content:
${fileContent}

Extract the customer, items, and generate actionable tasks.` 
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service requires credits. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to process document with AI");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    // Try to parse the JSON from the AI response
    let parsedResult;
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", content);
      parsedResult = {
        rawResponse: content,
        actions: ["Review document manually - AI could not structure the response"],
      };
    }

    return new Response(JSON.stringify({ 
      success: true, 
      fileName,
      result: parsedResult 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error parsing PO:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
