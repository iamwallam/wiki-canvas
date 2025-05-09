import { titleFromUrl, fetchPageData, toGraph } from "@/lib/wiki";
import { rankLinks } from "@/lib/llm"; // Your OpenRouter/Gemini ranking function
import { ingestImageStub } from "@/lib/ingest-image"; // <<< ADDED IMPORT
// console.log("INGEST env.OPENROUTER_KEY:", process.env.OPENROUTER_KEY); // Keep if useful for debugging

export const runtime = "edge"; // Specify Edge runtime

// Stub function for image ingestion (to be implemented in A-3/A-4)
// async function ingestImage(dataUrl) {
//   // TODO A-4: detect mime, call vision LLM, build graph
//   // For now return stub graph so front-end doesn't crash when this is actually called.
//   // This function's return value is not directly used in the POST handler for step A-2,
//   // as A-2 requires a 501 response for image dataUrls.
//   console.log("ingestImage called with (first 50 chars):", dataUrl.substring(0, 50) + "...");
//   return {
//     nodes: [
//       { id: "📸 Uploaded image", type: "image", url: dataUrl, val: 8, isCentral: true }
//     ],
//     links: []
//   };
// }

// Refactored function: Pure, throws errors for the POST handler to catch
async function ingestWiki(url) {
  const title = titleFromUrl(url);
  if (!title) {
    // This error will be caught by the POST handler's try...catch
    throw new Error("Could not extract title from URL");
  }

  // Fetch the summary and raw links from Wikipedia
  const wikiData = await fetchPageData(title); // Can throw if fetch fails or title is invalid for API

  // Rank the links using your LLM function
  const rankedLinkObjects = await rankLinks(
    wikiData.summary.extract, // The text summary
    wikiData.links,           // Array of link titles
    title                     // The article title
  );

  // Moved log (as per instruction 1.e)
  console.log("Ranked Link Objects from LLM (in ingestWiki):", JSON.stringify(rankedLinkObjects, null, 2));

  // Prepare data for the toGraph function
  const graphDataInput = {
    summary: wikiData.summary,
    links: rankedLinkObjects    // Now passing the full objects with title & weight
  };

  const graph = toGraph(title, graphDataInput);
  return graph; // Returns graph data or throws error
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { url, dataUrl } = body;

    // 1. Neither url nor dataUrl provided (Error map point 1)
    if (!url && !dataUrl) {
      return Response.json({ error: "url or dataUrl is required" }, { status: 400 });
    }

    let graphData;

    if (dataUrl) {
      // 2. dataUrl is present
      // 1.c & Error map point 3: Content-Type guard for dataUrl
      if (!dataUrl.startsWith('data:image/')) {
        return Response.json({ error: "Please upload an image file" }, { status: 415 });
      }

      // 1.d & Error map point 4: Return 501 for image ingest stub for step A-2
      // The ingestImage function is defined but its output is not returned here for A-2.
      // In a future step (A-3/A-4), this branch will call 'await ingestImage(dataUrl)'.
      // return Response.json({ error: "Image ingestion coming soon – wiki links already work!" }, { status: 501 });
      graphData = await ingestImageStub({ dataUrl });
      return Response.json(graphData);

    } else if (url) {
      // 3. url is present (and dataUrl was not)

      // --- START: New logic for Fix B ---
      const isWiki = url.startsWith("https://en.wikipedia.org/");
      // This regex checks if the URL ends with .png, .jpg, .jpeg, .gif, or .webp, case-insensitively
      const isImg  = /\\.(png|jpe?g|gif|webp)$/i.test(url);

      // If it IS an image URL, handle it
      if (isImg) {
        console.log(`Remote image URL detected: ${url}. Calling ingestImageStub.`);
        // Use the imported ingestImageStub, assuming it expects a { url } or { dataUrl } like object.
        // The original plan's stub took { url }, the file's stub seems to take { dataUrl }.
        // For remote images, we pass { url } and let the stub adapt or be adapted later if needed.
        graphData = await ingestImageStub({ url: url }); // Pass remote URL to the existing stub
        return Response.json(graphData);
      }

      // If it's NOT an image URL, then proceed with Wikipedia check.
      // If it's also not a wiki URL, the next check will catch it.
      // --- END: New logic for Fix B ---

      // 1.b & Error map point 2: Validate Wikipedia link format
      // This check is now effectively an "else if not an image, is it a valid wiki URL?"
      if (!isWiki) { // only check this if it wasn't an image and wasn't a wiki
        return Response.json({ error: "URL must be en.wikipedia or an image" }, { status: 400 });
      }
      // If it is a Wiki URL (and not an image URL that was handled above)
      graphData = await ingestWiki(url); // Call pure function
      return Response.json(graphData);
    }

  } catch (err) {
    console.error("Error in /api/ingest:", err); // Keep server-side log for debugging

    // Error Mapping from error table & instruction 1.a
    // The "url but not wiki" (400 "Only en.wikipedia URLs supported") and
    // "dataUrl not data:image/*" (415 "Please upload an image file") and
    // "no url and no dataUrl" (400 "url or dataUrl is required") and
    // "image ingest stub" (501 "Image ingestion coming soon...")
    // are handled directly above before this catch block.

    // This catch block primarily handles errors from ingestWiki or unexpected issues.
    if (err.message === "Could not extract title from URL") {
      // This specific error from ingestWiki implies it was a Wikipedia URL (passed the startsWith check),
      // but the title extraction part specifically failed.
      return Response.json({ error: err.message }, { status: 400 });
    }
    // Add other specific error type checks from ingestWiki if they become distinct

    // Generic fallback error for unexpected issues (e.g., LLM failure, Wikipedia API down)
    return Response.json({ error: "Failed to process request" }, { status: 500 });
  }
}