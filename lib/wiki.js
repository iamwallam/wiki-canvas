/**
 * Extracts the Wikipedia article title from a URL.
 * Example: "https://en.wikipedia.org/wiki/JavaScript" -> "JavaScript"
 * @param {string} url The Wikipedia URL.
 * @returns {string} The decoded article title.
 */
export function titleFromUrl(url) {
  if (!url) return "";
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/');
    const title = parts[parts.length - 1];
    return decodeURIComponent(title.replace(/_/g, " ")); // Replace underscores and decode
  } catch (e) {
    console.error("Error extracting title from URL:", e);
    return ""; // Or throw the error, depending on desired handling
  }
}

/**
 * Fetches the summary and links for a given Wikipedia article title.
 * @param {string} title The title of the Wikipedia article.
 * @returns {Promise<Object>} A promise that resolves to an object containing
 *                            the article summary (extract) and an array of link titles.
 *                            Example: { summary: { extract: "..." }, links: ["Link1", "Link2"] }
 */
export async function fetchPageData(title) {
  if (!title) {
    throw new Error("A title is required to fetch page data.");
  }

  const WIKI_API_ENDPOINT = "https://en.wikipedia.org/w/api.php";

  // Parameters for fetching the summary (extract)
  const summaryParams = new URLSearchParams({
    action: "query",
    prop: "extracts",
    exintro: true,       // Get only the introductory section
    explaintext: true,   // Get plain text, not HTML
    titles: title,
    format: "json",
    origin: "*",         // Required for CORS if client-side, good practice for server-side
  });

  // Parameters for fetching links
  const linksParams = new URLSearchParams({
    action: "query",
    prop: "links",
    titles: title,
    pllimit: "max",      // Get as many links as possible (up to API limit per request)
    format: "json",
    origin: "*",
  });

  try {
    // Fetch summary and links concurrently
    const [summaryRes, linksRes] = await Promise.all([
      fetch(`${WIKI_API_ENDPOINT}?${summaryParams.toString()}`),
      fetch(`${WIKI_API_ENDPOINT}?${linksParams.toString()}`),
    ]);

    if (!summaryRes.ok || !linksRes.ok) {
      throw new Error(`Wikipedia API request failed. Summary: ${summaryRes.statusText}, Links: ${linksRes.statusText}`);
    }

    const summaryData = await summaryRes.json();
    const linksData = await linksRes.json();

    const pages = summaryData.query.pages;
    const pageId = Object.keys(pages)[0]; // Get the first (and usually only) page ID

    let articleSummary = "";
    if (pageId && pages[pageId] && pages[pageId].extract) {
      articleSummary = pages[pageId].extract;
    } else if (pageId && pages[pageId] && pages[pageId].missing !== undefined) {
      throw new Error(`Wikipedia article "${title}" not found.`);
    }


    let articleLinks = [];
    const linksPage = linksData.query.pages[pageId];
    if (linksPage && linksPage.links) {
      articleLinks = linksPage.links.map(link => link.title);
    }

    return {
      summary: { extract: articleSummary },
      links: articleLinks,
    };
  } catch (error) {
    console.error("Error fetching Wikipedia page data:", error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

/**
 * Transforms fetched Wikipedia data into a graph structure.
 * @param {string} rootTitle The title of the main article (root node).
 * @param {Object} data An object containing the summary and an array of link titles.
 *                       Example: { summary: { extract: "..." }, links: ["Link1", "Link2"] }
 * @returns {Object} An object with 'nodes' and 'links' arrays for the graph.
 *                   Example: { nodes: [{id: "Title"}, ...], links: [{source: "Title", target: "Link1"}, ...] }
 */
export function toGraph(rootTitle, data) {
  if (!rootTitle || !data) {
    console.warn("Root title and data are required for toGraph.");
    return { nodes: [], links: [] };
  }

  const nodes = [];
  const links = [];

  // Add the root node (the main article)
  nodes.push({
    id: rootTitle,
    name: rootTitle, // Display name for the node
    val: 10,         // A default value for size, can be adjusted
    isCentral: true, // Custom property to identify the central node
    weight: 1        // Add weight of 1 for the root node
  });

  if (data.links && Array.isArray(data.links)) {
    data.links.forEach(linkObj => {
      // Calculate node size based on weight
      const weight = typeof linkObj.weight === 'number' ? linkObj.weight : 0.3;
      const nodeVal = 2 + weight * 8;   // scale 0-1 → 2-10

      // Add a node for each linked article
      nodes.push({
        id: linkObj.title,
        name: linkObj.title,
        val: nodeVal,
        weight: weight,  // Store the original weight for tooltips
        isCentral: false
      });
      
      // Add a link from the root node to this linked article
      links.push({
        source: rootTitle,
        target: linkObj.title,
      });
    });
  } else {
    console.warn("No links data provided to toGraph or data.links is not an array.");
  }
  
  return { nodes, links };
}

/**
 * Maps a weight value between 0 and 1 to a font size between 2 and 10.
 * @param {number} w The weight value between 0 and 1
 * @returns {number} The corresponding font size between 2 and 10
 */
export function fontSizeFromWeight(w) {
  return 2 + w * 8;
}