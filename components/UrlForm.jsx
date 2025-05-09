"use client";
import { useState, useRef } from "react";

// Helper function to convert a file to a base64 data URL
const toDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export default function UrlForm({ onGraph }) {
  const [url, setUrl] = useState("");
  const fileInputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    let payload;
    const selectedFile = fileInputRef.current?.files[0];
    const currentUrl = url.trim();

    if (selectedFile) {
      try {
        const b64 = await toDataURL(selectedFile);
        payload = { dataUrl: b64 };
      } catch (error) {
        console.error("Error converting file to Data URL:", error);
        alert("Failed to read image file. Please try again.");
        return;
      }
    } else if (currentUrl) {
      payload = { url: currentUrl };
    } else {
      alert("Please provide a URL or select an image file.");
      return; 
    }

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.nodes) {
        onGraph(json);
        setUrl(""); 
        if (fileInputRef.current) {
          fileInputRef.current.value = null; 
        }
      } else {
        alert(json.error || `Failed: ${res.statusText || res.status}`);
      }
    } catch (error) {
      console.error("Fetch API call failed:", error);
      alert("An error occurred while submitting the data. Please check the console.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-2 absolute z-10">
      <div>
        <input
          className="w-80 px-3 py-1 rounded border border-gray-300 text-sm"
          placeholder="Paste a Wikipedia URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="text-sm text-gray-500 self-center">Or</div>
      <div>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="w-80 text-sm text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
        />
      </div>
      <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm mt-2 self-start">
        Load
      </button>
    </form>
  );
} 