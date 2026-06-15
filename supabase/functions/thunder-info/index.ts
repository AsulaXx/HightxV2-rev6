import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: API key MUST come from server env only.
    // Previously accepted from request body — that leaked the key because
    // clients read it from public Firestore `settings/site`.
    const THUNDER_API_KEY = Deno.env.get('THUNDER_API_KEY');
    if (!THUNDER_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: { code: 'CONFIG_ERROR', message: 'THUNDER_API_KEY not configured' } }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch('https://api.thunder.in.th/v2/info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${THUNDER_API_KEY}`,
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Thunder info error:', message);
    return new Response(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message } }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
