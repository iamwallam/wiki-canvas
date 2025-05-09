// lib/llm.js (updated to use GPT-4o + refined prompt logic)

const OPENROUTER_API_KEY = process.env.OPENROUTER_KEY;
const LLM_CACHE_SUCCESS = new Map();
const LLM_CACHE_FAILURE = new Map();
const FAILURE_CACHE_DURATION_MS = 5 * 60 * 1000;

function cleanJsonResponse(text) {
  const match = /```json\n([\s\S]*?)\n```/.exec(text);
  return match?.[1] || text;
}

async function callLLM(model, systemPrompt, userInput) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://fractalclicks.com",
      "X-Title": "Fractal Clicks"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ]
    })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${error}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("No message content returned from OpenRouter");
  return cleanJsonResponse(content);
}

export async function rankLinks(summary, links, articleTitle) {
  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_KEY not set – returning fallback weights.");
    return links.slice(0, 10).map(title => ({ title, weight: 0.3 }));
  }

  const cacheKey = articleTitle || summary.slice(0, 100);

  if (LLM_CACHE_FAILURE.has(cacheKey) && Date.now() - LLM_CACHE_FAILURE.get(cacheKey) < FAILURE_CACHE_DURATION_MS) {
    console.warn(`Cached failure for "${cacheKey}" – skipping LLM.`);
    return links.slice(0, 10).map(title => ({ title, weight: 0.3 }));
  }

  if (LLM_CACHE_SUCCESS.has(cacheKey)) return LLM_CACHE_SUCCESS.get(cacheKey);

  const truncatedSummary = summary.length > 750 ? summary.slice(0, 750) + "..." : summary;
  const inputJson = JSON.stringify({ summary: truncatedSummary, links }).slice(0, 12000);

  const systemPrompt = `You are a human-centered semantic mapper for Wikipedia.

You will receive:
- A summary of a Wikipedia article
- A list of internally linked article titles

Your task is to select and rank the **10 most conceptually important** linked titles based on how a human would associate ideas, context, themes, and references to the main article.

PRIORITIZE:
• Big umbrella concepts (e.g. "Christianity" for "Catholic Church")
• Core figures, events, institutions, ideas, movements
• Philosophical, historical, artistic, or cultural anchors
• Subtopics that people would naturally think of or associate mentally

AVOID:
• Redundant links or near duplicates (e.g. "Catholic Church" and "The Catholic Church")
• Generic metadata or administrative links
• Disambiguation or list pages unless essential

SCORING (weights from 1 to 10):
• 10 = Crucial and identity-defining
• 7–9 = Primary relevance
• 4–6 = Supporting context
• 1–3 = Peripheral or indirect

RULES:
• You must use at least 3 scoring bands
• Do not assign the same score to more than two items
• Return raw JSON only: [{"title": "...", "weight": 9}, ...]
• Do not invent or hallucinate titles – only select from the list provided
• Avoid over-representation of technical or tangential links
• Think like a thoughtful, well-informed human reader

Begin.`;

  try {
    const response = await callLLM("openai/gpt-4o", systemPrompt, inputJson);
    const ranked = JSON.parse(response);
    LLM_CACHE_SUCCESS.set(cacheKey, ranked);
    return ranked;
  } catch (err) {
    console.error("LLM ranking failed:", err);
    LLM_CACHE_FAILURE.set(cacheKey, Date.now());
    return links.slice(0, 10).map(title => ({ title, weight: 0.3 }));
  }
}
