const WIKI = "https://en.wikipedia.org/api/rest_v1";

export function titleFromUrl(url) {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split("/").pop() || "").replace(/ /g, "_");
  } catch {
    return "";
  }
}

export async function fetchPageData(title, maxLinks = 20) {
  const encoded = encodeURIComponent(title);   // ensure RESTBase‐safe path
  const summaryRes = await fetch(`${WIKI}/page/summary/${encoded}`);
  if (!summaryRes.ok) throw new Error(`summary fetch failed (${summaryRes.status})`);
  const summary = await summaryRes.json();

  // -------- fetch linked pages via MediaWiki Action API --------
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=links&titles=${encoded}&plnamespace=0&pllimit=${maxLinks}&format=json&origin=*`;
  const linksRes = await fetch(apiUrl);
  if (!linksRes.ok) throw new Error(`links fetch failed (${linksRes.status})`);
  const linksJson = await linksRes.json();

  // linksJson.query.pages is an object keyed by pageid; take first value
  const pageObj = Object.values(linksJson.query.pages)[0];
  const links = (pageObj.links || [])
    .slice(0, maxLinks)
    .map((l) => l.title.replace(/ /g, "_"));

  return { summary, links };
}

export function toGraph(root, { summary, links }) {
  const nodes = [
    { id: root, text: summary.extract, root: true },
    ...links.map((t) => ({ id: t })),
  ];
  const edges = links.map((t) => ({ source: root, target: t }));
  return { nodes, links: edges };
}