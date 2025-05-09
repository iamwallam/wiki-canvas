// lib/wiki.js (updated for semantic sizing and distance mapping)

// Configurable graph layout parameters
const NODE_SIZE_BASE = 2;
const NODE_SIZE_SCALE = 6;
const LINK_DIST_MIN = 120;
const LINK_DIST_MAX = 320;
const LINK_DIST_SCALE = 120;
const FONT_SIZE_BASE = 2;
const FONT_SIZE_SCALE = 8;

export function titleFromUrl(url) {
  if (!url) return "";
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/');
    const title = parts[parts.length - 1];
    return decodeURIComponent(title.replace(/_/g, " "));
  } catch (e) {
    console.error("Error extracting title from URL:", e);
    return "";
  }
}

export async function fetchPageData(title) {
  if (!title) throw new Error("A title is required to fetch page data.");

  const WIKI_API_ENDPOINT = "https://en.wikipedia.org/w/api.php";

  const summaryParams = new URLSearchParams({
    action: "query",
    prop: "extracts",
    exintro: true,
    explaintext: true,
    titles: title,
    format: "json",
    origin: "*",
  });

  const linksParams = new URLSearchParams({
    action: "query",
    prop: "links",
    titles: title,
    pllimit: "max",
    format: "json",
    origin: "*",
  });

  try {
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
    const pageId = Object.keys(pages)[0];
    const articleSummary = pages[pageId]?.extract || "";
    const rawLinks = linksData.query.pages[pageId]?.links || [];
    const articleLinks = rawLinks.map(link => link.title);

    return {
      summary: { extract: articleSummary },
      links: articleLinks,
    };
  } catch (error) {
    console.error("Error fetching Wikipedia page data:", error);
    throw error;
  }
}

export function toGraph(rootTitle, data) {
  if (!rootTitle || !data) {
    console.warn("Root title and data are required for toGraph.");
    return { nodes: [], links: [] };
  }

  const makeWikiUrl = title =>
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  const nodes = [];
  const links = [];

  // Gather and process weights for normalization
  let weights = [];
  if (data.links && Array.isArray(data.links)) {
    weights = data.links
      .filter(linkObj => typeof linkObj.weight === 'number')
      .map(linkObj => linkObj.weight);
    // Clamp weights to [0.2, 1]
    weights = weights.map(w => Math.max(0.2, Math.min(1, w)));
    // Normalize if spread is too small
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    let normWeights = weights;
    if (maxW - minW < 0.25) {
      // If all weights are too close, spread them out
      normWeights = weights.map((w, i) => 0.2 + 0.8 * (i / Math.max(1, weights.length - 1)));
    } else {
      // Min-max normalize to [0.2, 1]
      normWeights = weights.map(w => 0.2 + 0.8 * ((w - minW) / (maxW - minW)));
    }
    // Assign normalized weights back to data.links
    let normIdx = 0;
    data.links.forEach(linkObj => {
      if (typeof linkObj.weight === 'number') {
        linkObj.weight = normWeights[normIdx++];
      } else {
        linkObj.weight = 0.2;
      }
    });
  }

  // Add the root node (the main article)
  nodes.push({
    id: rootTitle,
    name: rootTitle,
    val: NODE_SIZE_BASE + NODE_SIZE_SCALE * 2,
    isCentral: true,
    weight: 1,
    url: makeWikiUrl(rootTitle)
  });

  if (data.links && Array.isArray(data.links)) {
    data.links.forEach(linkObj => {
      // Skip if the link title matches the root title (case-insensitive, trimmed)
      if (typeof linkObj.title === 'string' && linkObj.title.trim().toLowerCase() === rootTitle.trim().toLowerCase()) {
        return;
      }
      // Use processed weight
      const weight = typeof linkObj.weight === 'number' ? linkObj.weight : 0.2;
      const nodeVal = NODE_SIZE_BASE + weight * NODE_SIZE_SCALE;
      nodes.push({
        id: linkObj.title,
        name: linkObj.title,
        val: nodeVal,
        weight: weight,
        isCentral: false,
        url: makeWikiUrl(linkObj.title)
      });
      links.push({
        source: rootTitle,
        target: linkObj.title,
        distance: Math.max(LINK_DIST_MIN, Math.min(LINK_DIST_MAX, LINK_DIST_MAX - weight * LINK_DIST_SCALE))
      });
    });
  } else {
    console.warn("No links data provided to toGraph or data.links is not an array.");
  }
  
  return { nodes, links };
}

export function fontSizeFromWeight(w) {
  return FONT_SIZE_BASE + w * FONT_SIZE_SCALE;
}