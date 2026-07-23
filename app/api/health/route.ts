import { env } from "cloudflare:workers";

export async function GET() {
  return Response.json({
    ok: true,
    service: "totalk",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    checks: {
      d1Configured: Boolean(env.DB),
      turnConfigured: Boolean(env.TURN_URLS?.trim()),
    },
  });
}