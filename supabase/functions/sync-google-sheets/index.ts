import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1OgqxbZYGaMVWEHJ_up-_F3fBzhaNJ8I-7jT9vhvUFwI';

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

async function getAccessToken(serviceAccountKey: ServiceAccountKey): Promise<string> {
  const jwtHeader = btoa(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT'
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = btoa(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const unsignedJwt = `${jwtHeader}.${jwtClaimSet}`;
  
  // Import private key - handle the PEM format correctly
  const privateKey = serviceAccountKey.private_key;
  
  // Remove PEM headers/footers and normalize newlines/escapes
  const pem = privateKey
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\\n/g, '') // remove literal "\n"
    .replace(/\r?\n/g, '') // remove actual newlines
    .replace(/\s+/g, '')
    .trim();
  
  // Decode base64 to binary
  const binaryDerString = atob(pem);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(unsignedJwt)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${unsignedJwt}.${signatureBase64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenResponse.ok) {
    console.error('Token response error:', tokenData);
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  
  return tokenData.access_token;
}

async function getFirstSheetTitle(accessToken: string): Promise<string> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets(properties(title))`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );
  if (!metaRes.ok) {
    const errText = await metaRes.text();
    console.error('Sheets metadata error:', errText);
    throw new Error(`Failed to fetch sheet metadata: ${metaRes.statusText}`);
  }
  const meta = await metaRes.json();
  const title = meta?.sheets?.[0]?.properties?.title as string | undefined;
  if (!title) throw new Error('No sheets found in spreadsheet');
  return title;
}

async function readSheetData(accessToken: string, range?: string) {
  // If no range provided, default to first sheet's A:Z
  let effectiveRange = range;
  if (!effectiveRange) {
    const firstTitle = await getFirstSheetTitle(accessToken);
    effectiveRange = `${firstTitle}!A:Z`;
  }

  let response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${effectiveRange}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    let errorBody: any = undefined;
    try { errorBody = await response.json(); } catch { errorBody = await response.text(); }
    console.error('Google Sheets API error:', errorBody);

    const message = typeof errorBody === 'object' ? errorBody?.error?.message : String(errorBody);

    // Fallback: if range cannot be parsed, try first sheet automatically
    if (message && message.includes('Unable to parse range')) {
      const firstTitle = await getFirstSheetTitle(accessToken);
      const fallbackRange = `${firstTitle}!A:Z`;
      console.log(`Retrying with fallback range: ${fallbackRange}`);
      response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${fallbackRange}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        let fbErr: any = undefined;
        try { fbErr = await response.json(); } catch { fbErr = await response.text(); }
        console.error('Google Sheets API fallback error:', fbErr);
        throw new Error(`Failed to read sheet (fallback): ${response.statusText} - ${typeof fbErr === 'object' ? fbErr?.error?.message : String(fbErr)}`);
      }

      return await response.json();
    }

    throw new Error(`Failed to read sheet: ${response.statusText} - ${message || 'Unknown error'}`);
  }

  return await response.json();
}

async function writeSheetData(accessToken: string, range: string, values: any[][]) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Google Sheets API error:', error);
    throw new Error(`Failed to write sheet: ${response.statusText}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, range, data } = await req.json();
    
    const serviceAccountKeyJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKeyJson) {
      throw new Error('Google Service Account Key not configured');
    }

    const serviceAccountKey: ServiceAccountKey = JSON.parse(serviceAccountKeyJson);
    const accessToken = await getAccessToken(serviceAccountKey);

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    let result;
    
    if (action === 'read') {
      // If no range provided, let readSheetData determine the first sheet automatically
      result = await readSheetData(accessToken, range);
      console.log('Successfully read sheet data');
      
      // Parse and store inventory data in the database
      if (result?.values && Array.isArray(result.values)) {
        const values = result.values;
        
        // Find header row - look for "ProductID" or "ProductName"
        const headerRowIndex = values.findIndex((row: string[]) => 
          row.some(cell => cell && (cell.includes("ProductID") || cell.includes("ProductName")))
        );
        
        console.log('Found header at row:', headerRowIndex);
        
        if (headerRowIndex !== -1 && headerRowIndex < values.length - 1) {
          const headers = values[headerRowIndex];
          console.log('Headers:', headers);
          
          // Find column indices
          const productNameIdx = headers.findIndex((h: string) => h && h.includes("ProductName"));
          const categoryIdx = headers.findIndex((h: string) => h && h.includes("Category"));
          const reorderLevelIdx = headers.findIndex((h: string) => h && h.includes("ReorderLevel"));
          const unitsIdx = headers.findIndex((h: string) => h && h.toLowerCase().includes("units") && !h.includes("Reorder"));
          const casesIdx = headers.findIndex((h: string) => h && h.toLowerCase().includes("cases") && !h.includes("Reorder"));
          
          console.log('Column indices:', { productNameIdx, categoryIdx, reorderLevelIdx, unitsIdx, casesIdx });
          
          const inventoryItems = [];
          
          for (let i = headerRowIndex + 1; i < values.length; i++) {
            const row = values[i];
            
            // Skip empty rows
            if (!row || row.length === 0 || !row[productNameIdx] || row[productNameIdx].trim() === "") continue;
            
            const category = row[categoryIdx] || "";
            
            // Filter for only Pasta or Dust categories
            if (category !== "Pasta" && category !== "Dust") continue;
            
            const unitsOnHand = unitsIdx >= 0 ? (row[unitsIdx] || "0") : "0";
            const casesOnHand = casesIdx >= 0 ? (row[casesIdx] || "0") : "0";
            const reorderLevel = reorderLevelIdx >= 0 ? (row[reorderLevelIdx] || "") : "";
            
            // Calculate stock value (simplified - you may want to adjust this)
            const stockValue = "$0.00";
            
            // Determine reorder status
            const units = parseFloat(String(unitsOnHand).replace(/[^0-9.-]/g, '')) || 0;
            const reorderThreshold = parseFloat(String(reorderLevel).replace(/[^0-9.-]/g, '')) || 0;
            const needsReorder = units < reorderThreshold ? "Yes" : "No";
            
            inventoryItems.push({
              product_name: row[productNameIdx] || "",
              reorder_level: reorderLevel,
              units_on_hand: unitsOnHand,
              cases_on_hand: casesOnHand,
              stock_value: stockValue,
              reorder: needsReorder,
              last_synced: new Date().toISOString()
            });
          }
          
          console.log(`Found ${inventoryItems.length} inventory items`);
          
          if (inventoryItems.length > 0) {
            // Delete existing inventory items and insert new ones
            const { error: deleteError } = await supabaseClient
              .from('inventory_items')
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000');
            
            if (deleteError) {
              console.error('Error deleting old inventory:', deleteError);
            }
            
            const { error: insertError } = await supabaseClient
              .from('inventory_items')
              .insert(inventoryItems);
            
            if (insertError) {
              console.error('Error inserting inventory:', insertError);
            } else {
              console.log(`Stored ${inventoryItems.length} inventory items in database`);
            }
          }
        }
      }
    } else if (action === 'write') {
      // For writes, if no range is provided, default to first sheet A:Z
      const targetRange = range || `${await getFirstSheetTitle(accessToken)}!A:Z`;
      result = await writeSheetData(accessToken, targetRange, data);
      console.log('Successfully wrote sheet data');
    } else {
      throw new Error('Invalid action. Use "read" or "write"');
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-google-sheets function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
