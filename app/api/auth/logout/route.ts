import { deleteSession } from "../../../auth";

export async function POST(request: Request) {
  const cookie = await deleteSession(request);
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie } });
}
