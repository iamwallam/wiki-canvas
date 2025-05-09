"use client";
import { useState } from "react";
import Graph3D from "@/components/Graph3D";
import UrlForm from "@/components/UrlForm";

// --- START: New helper function for Fix A ---
const mergeGraphData = (currentGraph, newData) => {
  // Ensure currentGraph is not null and has nodes/links arrays
  // Initialize with empty arrays if currentGraph is null or doesn't have them
  const currentNodes = currentGraph?.nodes || [];
  const currentLinks = currentGraph?.links || [];
  
  const newNodesToAdd = newData?.nodes || [];
  const newLinksToAdd = newData?.links || [];

  // Add new nodes if they don\'t already exist (check by ID)
  const combinedNodes = [...currentNodes];
  newNodesToAdd.forEach(newNode => {
    if (!currentNodes.some(existingNode => existingNode.id === newNode.id)) {
      combinedNodes.push(newNode);
    }
    // Optional: Else, you could update existing node properties here if needed
  });

  // Add new links if they don\'t already exist (check by source AND target ID)
  // Also checks for reverse links in undirected graphs to avoid duplicates like (A->B and B->A)
  const combinedLinks = [...currentLinks];
  newLinksToAdd.forEach(newLink => {
    const linkExists = currentLinks.some(existingLink =>
      (existingLink.source === newLink.source && existingLink.target === newLink.target) ||
      (existingLink.source === newLink.target && existingLink.target === newLink.source) 
    );
    if (!linkExists) {
      combinedLinks.push(newLink);
    }
  });

  return { nodes: combinedNodes, links: combinedLinks };
};
// --- END: New helper function for Fix A ---

export default function Home() {
  const [graph, setGraph] = useState(null);

  // --- START: Modified handler for Fix A ---
  const handleNewGraphData = (newGraphFragment) => {
    setGraph(prevGraphData => mergeGraphData(prevGraphData, newGraphFragment));
  };
  // --- END: Modified handler for Fix A ---

  return (
    <>
      <UrlForm onGraph={handleNewGraphData} />
      <Graph3D data={graph} />
    </>
  );
}