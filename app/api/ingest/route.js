import { titleFromUrl, fetchPageData, toGraph } from "@/lib/wiki";

export const runtime = "edge";

export async function POST(req) {
  try {
    const { url } = await req.json();
    if (!url) {
      return Response.json({ error: "url required" }, { status: 400 });
    }

    const title = titleFromUrl(url);
    if (!title) {
      return Response.json({ error: "invalid wiki url" }, { status: 400 });
    }

    const data = await fetchPageData(title);
    return Response.json(toGraph(title, data));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}