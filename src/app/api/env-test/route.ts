export async function GET() {
  return Response.json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE_KEY ? "yes" : "NO!"
  });
}
