import { getDb } from "../../../db";

function isDbReachable() {
  try {
    getDb();
    return true;
  } catch (error) {
    console.error("[health] database unreachable:", error);
    return false;
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "totalk",
    version: "0.2.1",
    timestamp: new Date().toISOString(),
    checks: {
      dbConfigured: isDbReachable(),
      turnConfigured: Boolean(process.env.TURN_URLS?.trim()),
    },
  });
}
