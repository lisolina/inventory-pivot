import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log('Received forwarded email:', emailData);

    const emailBody = emailData.text || emailData.html || '';

    // Insert the forwarded email into the database
    const { data, error } = await supabase
      .from('forwarded_emails')
      .insert({
        email_from: emailData.from,
        email_subject: emailData.subject,
        email_body: emailBody,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting forwarded email:', error);
      throw error;
    }

    console.log('Forwarded email inserted successfully:', data);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing forwarded email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
