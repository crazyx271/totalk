import { getSessionUser } from "../../../auth";

const GIPHY_BASE = "https://api.giphy.com/v1/gifs";
const LIMIT = 24;

type GiphyImage = { url: string; width: string; height: string };
type GiphyGif = {
  id: string;
  title: string;
  images: { fixed_width: GiphyImage; original: GiphyImage };
};

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });

  const apiKey = process.env.GIPHY_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "GIPHY не настроен на сервере" }, { status: 503 });

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const endpoint = query ? "search" : "trending";
  const params = new URLSearchParams({ api_key: apiKey, limit: String(LIMIT), rating: "pg-13" });
  if (query) params.set("q", query);

  try {
    const response = await fetch(`${GIPHY_BASE}/${endpoint}?${params.toString()}`);
    if (!response.ok) return Response.json({ error: "GIPHY недоступен" }, { status: 502 });
    const data = await response.json() as { data: GiphyGif[] };
    const gifs = data.data.map((gif) => ({
      id: gif.id,
      title: gif.title,
      previewUrl: gif.images.fixed_width.url,
      url: gif.images.original.url,
      width: Number(gif.images.original.width) || undefined,
      height: Number(gif.images.original.height) || undefined,
    }));
    return Response.json({ gifs });
  } catch {
    return Response.json({ error: "GIPHY недоступен" }, { status: 502 });
  }
}
