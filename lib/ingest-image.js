export function ingestImageStub({ url, dataUrl }) {
  const src = dataUrl || url; // Prioritize dataUrl for thumb, fallback to url
  const id = `Image-${Date.now()}`; // millisecond-unique ID for Patch 3
  const name = id; // Use the unique ID as the name as well, or derive a more descriptive name if possible

  return {
    nodes: [{
      id,
      name: name,        // Front-end expects 'name'
      type: "image",
      url: url || dataUrl, // Retain original remote URL if it exists, else dataUrl
      thumb: dataUrl || url, // For display, prioritize dataUrl if it is an uploaded file
      val: 8,          // Arbitrary value, front-end might use for sizing
      isCentral: true  // Indicates this node could be a starting point
    }],
    links: []          // Ensure front-end merge logic doesn't crash
  };
} 