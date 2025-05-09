"use client";
import { useState } from "react";

export default function UrlForm({ onGraph }) {
  const [url, setUrl] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;

    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (json.nodes) onGraph(json);        // success
    else alert(json.error || "Failed");
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 flex gap-2 absolute z-10">
      <input
        className="w-80 px-3 py-1 rounded border border-gray-300 text-sm"
        placeholder="Paste a Wikipedia URL…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Load</button>
    </form>
  );
} 