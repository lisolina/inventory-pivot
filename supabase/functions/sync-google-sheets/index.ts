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
  }));

  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = btoa(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));

  const unsignedJwt = `${jwtHeader}.${jwtClaimSet}`;
  
  // Import private key
  const privateKey = serviceAccountKey.private_key;
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = privateKey.substring(
    pemHeader.length,
    privateKey.length - pemFooter.length
  ).replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
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
  return tokenData.access_token;
}

async function readSheetData(accessToken: string, range: string = 'Sheet1!A:Z') {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Google Sheets API error:', error);
    throw new Error(`Failed to read sheet: ${response.statusText}`);
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

    let result;
    
    if (action === 'read') {
      result = await readSheetData(accessToken, range || 'Sheet1!A:Z');
      console.log('Successfully read sheet data');
    } else if (action === 'write') {
      result = await writeSheetData(accessToken, range || 'Sheet1!A:Z', data);
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
