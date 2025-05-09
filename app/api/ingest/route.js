import { titleFromUrl, fetchPageData, toGraph } from "@/lib/wiki";
import { rankLinks } from "@/lib/llm"; // Your OpenRouter/Gemini ranking function

export const runtime = "edge"; // Specify Edge runtime

export async function POST(req) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return Response.json({ error: "url required" }, { status: 400 });
    }

    const title = titleFromUrl(url);
    if (!title) {
      return Response.json({ error: "Could not extract title from URL" }, { status: 400 });
    }

    // Fetch the summary and raw links from Wikipedia
    const wikiData = await fetchPageData(title);

    // Rank the links using your LLM function
    // The rankLinks function in lib/llm.js expects: (summary, links, articleTitle)
    // Ensure wikiData.summary.extract and wikiData.links match these expectations.
    const rankedLinkObjects = await rankLinks(
      wikiData.summary.extract, // The text summary
      wikiData.links,           // Array of link titles
      title                     // The article title
    );

    // Prepare data for the toGraph function
    // toGraph expects: (rootTitle, data) where data is { summary, links (array of titles) }
    // We'll use the ranked link titles here.
    const graphDataInput = {
      summary: wikiData.summary,
      links: rankedLinkObjects.map(r => r.title) // Extract titles from ranked objects
    };

    const graph = toGraph(title, graphDataInput);

    return Response.json(graph);

  } catch (err) {
    console.error("Error in /api/ingest:", err);
    // Send a more generic error message to the client for security
    return Response.json({ error: err.message || "Failed to process request" }, { status: 500 });
  }
}