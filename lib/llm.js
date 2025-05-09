// lib/llm.js
const OPENROUTER_API_KEY = process.env.OPENROUTER_KEY;
const LLM_CACHE_SUCCESS = new Map();
const LLM_CACHE_FAILURE = new Map();
const FAILURE_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Helper to remove markdown fences if present
function cleanJsonResponse(text) {
  const match = /```json\n([\s\S]*?)\n```/.exec(text);
  if (match && match[1]) {
    return match[1];
  }
  return text;
}

export async function rankLinks(summary, links, articleTitle) {
  if (!OPENROUTER_API_KEY) {
    console.error("OPENROUTER_KEY is not set. Falling back to default links.");
    return links.slice(0, 10).map(title => ({ title, weight: 0.3 }));
  }

  const cacheKey = articleTitle || summary.slice(0, 100); // Use articleTitle or part of summary as cache key

  // Check failure cache first
  if (LLM_CACHE_FAILURE.has(cacheKey)) {
    const failureTimestamp = LLM_CACHE_FAILURE.get(cacheKey);
    if (Date.now() - failureTimestamp < FAILURE_CACHE_DURATION_MS) {
      console.warn(`LLM call for "${cacheKey}" failed recently. Returning fallback.`);
      return links.slice(0, 10).map(title => ({ title, weight: 0.3 }));
    } else {
      LLM_CACHE_FAILURE.delete(cacheKey); // Expired failure cache entry
    }
  }

  // Check success cache
  if (LLM_CACHE_SUCCESS.has(cacheKey)) {
    return LLM_CACHE_SUCCESS.get(cacheKey);
  }

  // Limit summary to save tokens (approx. 750 chars)
  const truncatedSummary = summary.length > 750 ? summary.substring(0, 750) + "..." : summary;
  const requestBody = {
    model: "google/gemini-flash-1.5", // Or your preferred model like "openai/gpt-4o"
    messages: [
      {
        role: "system",
        content: `You are an **idea‑map assistant**.

Task  
From a Wikipedia article *summary* and a list (≤ 50) of link titles that actually appear in the article, return **up to 10** of the **most conceptually relevant** links, each with a numeric **weight** between 0 and 1.

Exclusion rules  
• Discard titles that match any of these patterns  
  - /^\\d{4}\\s[A-Z]/            e.g. “1999 in film”  
  - /^\\d{4}[_–-]/              e.g. “1888_Wimbledon_Championships – Women's singles”  
  - Bare top‑level or country domains such as “.com”, “.cn”, “.be”, “.design”.  
• Ignore generic top‑level categories or disambiguation pages.

Positive selection cues  
• Person bios directly tied to the topic (inventor, producer, scientist, lead actor).  
• Core sub‑concepts, inventions or technologies.  
• Landmark awards, institutions, or defining events.  
• Aim for variety – not all people, not all dates.

Weight rubric  
• 0   = marginal relevance 1 = crucial.  
• Use at least three distinct clusters: ≥ 0.85, ~0.6–0.8, ≤ 0.35.  
• Do **not** assign the exact same weight to more than two items.  
• Ensure the set contains **at least one** item ≤ 0.3 and **one** ≥ 0.9 when possible.

Count rule  
• Return **exactly 10** items unless fewer than 10 valid links remain after filtering; then return that smaller number.  
• Never invent new titles; only pick from the supplied list.

Output format  
Respond with **raw JSON only** – no markdown fences, no preamble, no extra keys:

[
  {"title":"Some_Link_Title","weight":0.93},
  …
]
`
      },
      {
        role: "user",
        content: JSON.stringify({ summary: truncatedSummary, links }).slice(0, 12000) // Max content length
      }
    ]
  };

  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          // Recommended by OpenRouter for routing and latency improvements
          // Replace with your actual site URL and name if available
          "HTTP-Referer": "YOUR_SITE_URL", 
          "X-Title": "YOUR_SITE_NAME"      
        },
        body: JSON.stringify(requestBody)
      });

      if (res.status >= 500 && attempts === 1) { // Server error, retry once
        console.warn(`OpenRouter API returned status ${res.status}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        continue;
      }
      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`OpenRouter API request failed with status ${res.status}: ${errorBody}`);
      }

      const jsonResponse = await res.json();
      if (!jsonResponse.choices || !jsonResponse.choices[0] || !jsonResponse.choices[0].message || !jsonResponse.choices[0].message.content) {
        throw new Error("Invalid response structure from LLM.");
      }

      const rawContent = jsonResponse.choices[0].message.content;
      const cleanedContent = cleanJsonResponse(rawContent);
      const rankedLinks = JSON.parse(cleanedContent);

      LLM_CACHE_SUCCESS.set(cacheKey, rankedLinks); // Cache successful response
      return rankedLinks;

    } catch (error) {
      console.error(`Error ranking links (attempt ${attempts}):`, error);
      if (attempts === 1) { // If first attempt fails, log and retry
         await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      } else { // Second attempt also failed
        LLM_CACHE_FAILURE.set(cacheKey, Date.now()); // Cache failure
        console.error(`Failed to rank links for "${cacheKey}" after ${attempts} attempts. Returning fallback.`);
        return links.slice(0, 10).map(title => ({ title, weight: 0.3 }));
      }
    }
  }
  // Should not be reached if logic is correct, but as a final fallback:
  return links.slice(0, 10).map(title => ({ title, weight: 0.3 }));
}