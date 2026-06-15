import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  latencyMs: number;
  message?: string;
  checkedAt: string;
}

async function checkFirebaseAuth(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const projectId = Deno.env.get("VITE_FIREBASE_PROJECT_ID");
    if (!projectId) {
      return { name: "Firebase Auth", status: "down", latencyMs: 0, message: "Project ID not configured", checkedAt: new Date().toISOString() };
    }
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}`, {
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    // 403 is normal (no API key), but means the service is reachable
    if (res.ok || res.status === 403 || res.status === 400 || res.status === 404) {
      return { name: "Firebase Auth", status: latencyMs > 3000 ? "degraded" : "operational", latencyMs, checkedAt: new Date().toISOString() };
    }
    return { name: "Firebase Auth", status: "degraded", latencyMs, message: `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
  } catch (err) {
    return { name: "Firebase Auth", status: "down", latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "Unknown error", checkedAt: new Date().toISOString() };
  }
}

async function checkFirestore(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const projectId = Deno.env.get("VITE_FIREBASE_PROJECT_ID");
    if (!projectId) {
      return { name: "Firestore", status: "down", latencyMs: 0, message: "Project ID not configured", checkedAt: new Date().toISOString() };
    }
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`, {
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (res.ok || res.status === 403 || res.status === 401) {
      return { name: "Firestore", status: latencyMs > 3000 ? "degraded" : "operational", latencyMs, checkedAt: new Date().toISOString() };
    }
    return { name: "Firestore", status: "degraded", latencyMs, message: `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
  } catch (err) {
    return { name: "Firestore", status: "down", latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "Unknown error", checkedAt: new Date().toISOString() };
  }
}

async function checkThunderApi(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    let thunderApiKey: string | undefined;
    thunderApiKey = Deno.env.get("THUNDER_API_KEY");
    if (!thunderApiKey) {
      return { name: "Thunder API", status: "down", latencyMs: 0, message: "API Key not configured", checkedAt: new Date().toISOString() };
    }
    const res = await fetch("https://api.thunder.in.th/v2/info", {
      headers: { Authorization: `Bearer ${thunderApiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      const quota = data?.data?.quota;
      let message: string | undefined;
      if (quota !== undefined && quota < 50) {
        message = `โควต้าเหลือ ${quota} ครั้ง`;
      }
      return { name: "Thunder API", status: latencyMs > 3000 ? "degraded" : "operational", latencyMs, message, checkedAt: new Date().toISOString() };
    }
    return { name: "Thunder API", status: res.status === 401 ? "down" : "degraded", latencyMs, message: `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
  } catch (err) {
    return { name: "Thunder API", status: "down", latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "Unknown error", checkedAt: new Date().toISOString() };
  }
}

async function checkSupabaseEdge(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) {
      return { name: "Edge Functions", status: "down", latencyMs: 0, message: "URL not configured", checkedAt: new Date().toISOString() };
    }
    const res = await fetch(`${url}/functions/v1/`, {
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    // 404 or 401 is fine — means edge runtime is reachable
    return { name: "Edge Functions", status: latencyMs > 3000 ? "degraded" : "operational", latencyMs, checkedAt: new Date().toISOString() };
  } catch (err) {
    return { name: "Edge Functions", status: "down", latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "Unknown error", checkedAt: new Date().toISOString() };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const [firebaseAuth, firestore, thunder, edge] = await Promise.all([
      checkFirebaseAuth(),
      checkFirestore(),
      checkThunderApi(),
      checkSupabaseEdge(),
    ]);

    const services = [firebaseAuth, firestore, thunder, edge];
    const allOperational = services.every(s => s.status === "operational");
    const anyDown = services.some(s => s.status === "down");

    return new Response(
      JSON.stringify({
        overall: anyDown ? "down" : allOperational ? "operational" : "degraded",
        services,
        checkedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Health check error:", message);
    return new Response(
      JSON.stringify({ overall: "down", services: [], error: message, checkedAt: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
